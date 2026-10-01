import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
  FirebaseAuthError: class FirebaseAuthError extends Error {},
}));

describe('Notification devices and first maintenance persistence (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let firstUserId: string;
  let secondUserId: string;
  let firstVehicleId: string;
  let secondVehicleId: string;

  const suffix = randomUUID();
  const firstIdentity = {
    uid: `notification-first-${suffix}`,
    email: `notification-first-${suffix}@example.com`,
    name: 'First Driver',
  };
  const secondIdentity = {
    uid: `notification-second-${suffix}`,
    email: `notification-second-${suffix}@example.com`,
    name: 'Second Driver',
  };

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();

    const firstUser = await prisma.user.create({
      data: {
        firebaseUid: firstIdentity.uid,
        email: firstIdentity.email,
        name: firstIdentity.name,
      },
    });
    const secondUser = await prisma.user.create({
      data: {
        firebaseUid: secondIdentity.uid,
        email: secondIdentity.email,
        name: secondIdentity.name,
      },
    });
    firstUserId = firstUser.id;
    secondUserId = secondUser.id;

    const [firstVehicle, secondVehicle] = await Promise.all([
      prisma.vehicle.create({
        data: {
          ownerId: firstUserId,
          brand: 'Honda',
          model: 'Civic',
          year: 2021,
          fuel: 'NAFTA',
          plate: 'AG123ZZ',
          mileage: 48000,
        },
      }),
      prisma.vehicle.create({
        data: {
          ownerId: firstUserId,
          brand: 'Toyota',
          model: 'Corolla',
          year: 2022,
          fuel: 'NAFTA',
          plate: 'AG124ZZ',
          mileage: 52000,
        },
      }),
    ]);
    firstVehicleId = firstVehicle.id;
    secondVehicleId = secondVehicle.id;

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FirebaseService)
      .useValue({
        verifyIdToken: jest.fn(async (token: string) =>
          token === 'second-token' ? secondIdentity : firstIdentity,
        ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (firstUserId || secondUserId) {
      await prisma.vehicle.deleteMany({
        where: { ownerId: { in: [firstUserId, secondUserId] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [firstUserId, secondUserId] } } });
    }
    if (prisma) await prisma.$disconnect();
  });

  it('serializes concurrent creations across vehicles so only one is the first', async () => {
    const create = (vehicleId: string, type: string, mileage: number) =>
      request(app.getHttpServer())
        .post(`/vehicles/${vehicleId}/maintenances`)
        .set('Authorization', 'Bearer first-token')
        .send({
          type,
          category: 'MANTENIMIENTO',
          date: '2026-10-01',
          mileage,
          workshop: null,
          cost: null,
          notes: null,
        });

    const responses = await Promise.all([
      create(firstVehicleId, 'Aceite', 49000),
      create(secondVehicleId, 'Filtros', 53000),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses.map((response) => response.body.isFirstMaintenance).sort()).toEqual([
      false,
      true,
    ]);
  });

  it('rotates, transfers and isolates notification installations', async () => {
    const firstInstallation = randomUUID();
    const secondInstallation = randomUUID();
    const path = '/me/notification-devices';
    const register = (authToken: string, installationId: string, token: string) =>
      request(app.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ installationId, token })
        .expect(200);

    await register('first-token', firstInstallation, 'token-one');
    await register('first-token', firstInstallation, 'token-one');
    await register('first-token', firstInstallation, 'token-rotated');
    await register('first-token', secondInstallation, 'token-two');

    expect(await prisma.notificationDevice.count({ where: { userId: firstUserId } })).toBe(2);

    await register('second-token', firstInstallation, 'token-rotated');
    expect(
      await prisma.notificationDevice.findUnique({ where: { installationId: firstInstallation } }),
    ).toMatchObject({ userId: secondUserId, token: 'token-rotated' });

    await request(app.getHttpServer())
      .delete(`${path}/${firstInstallation}`)
      .set('Authorization', 'Bearer first-token')
      .expect(204);
    expect(
      await prisma.notificationDevice.count({ where: { installationId: firstInstallation } }),
    ).toBe(1);

    await request(app.getHttpServer())
      .delete(`${path}/${firstInstallation}`)
      .set('Authorization', 'Bearer second-token')
      .expect(204);
    expect(
      await prisma.notificationDevice.count({ where: { installationId: firstInstallation } }),
    ).toBe(0);

    const users = await prisma.user.findMany({
      where: { id: { in: [firstUserId, secondUserId] } },
      select: { notificationsEnabled: true },
    });
    expect(users.every((user) => user.notificationsEnabled)).toBe(true);
  });

  it('serializes concurrent claims for the same notification token', async () => {
    const sharedToken = `shared-token-${randomUUID()}`;
    const firstInstallation = randomUUID();
    const secondInstallation = randomUUID();
    const register = (authToken: string, installationId: string) =>
      request(app.getHttpServer())
        .post('/me/notification-devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ installationId, token: sharedToken });

    const responses = await Promise.all([
      register('first-token', firstInstallation),
      register('second-token', secondInstallation),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const devices = await prisma.notificationDevice.findMany({ where: { token: sharedToken } });
    expect(devices).toHaveLength(1);
    expect([firstInstallation, secondInstallation]).toContain(devices[0]?.installationId);
  });

  it('keeps the original prompt timestamp and never exposes devices from GET /me', async () => {
    await request(app.getHttpServer())
      .patch('/me/notification-prompt')
      .set('Authorization', 'Bearer first-token')
      .expect(204);
    const firstResponse = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', 'Bearer first-token')
      .expect(200);

    await request(app.getHttpServer())
      .patch('/me/notification-prompt')
      .set('Authorization', 'Bearer first-token')
      .expect(204);
    const secondResponse = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', 'Bearer first-token')
      .expect(200);

    expect(secondResponse.body.notificationPromptShownAt).toBe(
      firstResponse.body.notificationPromptShownAt,
    );
    expect(secondResponse.body).not.toHaveProperty('notificationDevices');
  });
});
