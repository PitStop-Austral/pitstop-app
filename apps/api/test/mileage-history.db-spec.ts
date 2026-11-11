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
import { argentinaDate } from '../src/modules/schedules/schedule-date';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
  FirebaseAuthError: class FirebaseAuthError extends Error {},
}));

const day = (date: Date) => date.toISOString().slice(0, 10);

describe('Mileage history API (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let vehicleId: string;
  const userIds: string[] = [];

  const runId = randomUUID();
  const owner = { uid: `mileage-history-a-${runId}`, token: 'token-a' };
  const stranger = { uid: `mileage-history-b-${runId}`, token: 'token-b' };
  const auth = (user: { token: string }) => `Bearer ${user.token}`;

  async function createUser(uid: string) {
    const user = await prisma.user.create({
      data: { firebaseUid: uid, email: `${uid}@example.com`, name: 'Mileage History Driver' },
    });
    userIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();

    const ownerUser = await createUser(owner.uid);
    await createUser(stranger.uid);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    vehicleId = (
      await prisma.vehicle.create({
        data: {
          ownerId: ownerUser.id,
          brand: 'Honda',
          model: 'Civic',
          year: 2021,
          fuel: 'NAFTA',
          plate: 'AF812KM',
          mileage: 40000,
          initialMileage: 40000,
          createdAt: twoYearsAgo,
        },
      })
    ).id;

    const usersByToken = { [owner.token]: owner.uid, [stranger.token]: stranger.uid };
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FirebaseService)
      .useValue({
        verifyIdToken: jest.fn((token: string) => {
          const uid = usersByToken[token];
          return Promise.resolve({
            uid,
            email: `${uid}@example.com`,
            name: 'Mileage History Driver',
          });
        }),
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
    if (!prisma) return;
    // Vehicles cascade to their maintenances and mileage readings.
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('records each mileage update and combines it with the sign-up and maintenances', async () => {
    const today = argentinaDate();
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setUTCMonth(twoMonthsAgo.getUTCMonth() - 2);
    const oneYearAgo = new Date(today);
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

    await request(app.getHttpServer())
      .post(`/vehicles/${vehicleId}/maintenances`)
      .set('Authorization', auth(owner))
      .send({ type: 'Service', category: 'MANTENIMIENTO', date: day(twoMonthsAgo), mileage: 45000 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}/mileage`)
      .set('Authorization', auth(owner))
      .send({ mileage: 49000 })
      .expect(200);
    // Rejected for being lower: it must not add a reading.
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}/mileage`)
      .set('Authorization', auth(owner))
      .send({ mileage: 48000 })
      .expect(400);

    const response = await request(app.getHttpServer())
      .get(`/vehicles/${vehicleId}/mileage-history`)
      .set('Authorization', auth(owner))
      .expect(200);

    expect(await prisma.mileageReading.count({ where: { vehicleId } })).toBe(1);
    expect(response.body).toEqual({
      from: day(oneYearAgo),
      to: day(today),
      readingsCount: 3,
      startMileage: 40000,
      currentMileage: 49000,
      kmInPeriod: 9000,
      averageMonthlyKm: expect.any(Number),
      points: [
        { date: day(oneYearAgo), mileage: 40000, source: 'WINDOW_START' },
        { date: day(twoMonthsAgo), mileage: 45000, source: 'MAINTENANCE', label: 'Service' },
        { date: day(today), mileage: 49000, source: 'UPDATE' },
      ],
    });
  });

  it("returns 404 for another user's vehicle", async () => {
    const response = await request(app.getHttpServer())
      .get(`/vehicles/${vehicleId}/mileage-history`)
      .set('Authorization', auth(stranger))
      .expect(404);
    expect(response.body.message).toBe('Vehículo no encontrado');
  });

  it('requires a token', async () => {
    await request(app.getHttpServer()).get(`/vehicles/${vehicleId}/mileage-history`).expect(401);
  });
});
