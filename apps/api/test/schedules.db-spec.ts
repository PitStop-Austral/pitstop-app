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

describe('Schedules persistence (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let userId: string;
  let vehicleId: string;

  const firebaseUid = `schedule-test-${randomUUID()}`;
  const email = `${firebaseUid}@example.com`;
  const token = 'Bearer test-token';

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { firebaseUid, email, name: 'Schedule Test Driver' },
    });
    userId = user.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: user.id,
        brand: 'Honda',
        model: 'Civic',
        year: 2021,
        fuel: 'NAFTA',
        plate: 'AF812KM',
        mileage: 48000,
      },
    });
    vehicleId = vehicle.id;

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FirebaseService)
      .useValue({
        verifyIdToken: jest.fn().mockResolvedValue({ uid: firebaseUid, email, name: user.name }),
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
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (prisma) await prisma.$disconnect();
  });

  it('fetches saved frequencies with current and latest-maintenance baselines', async () => {
    const path = `/vehicles/${vehicleId}/schedules`;
    const argentinaDate = () =>
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    const dateBefore = argentinaDate();

    const currentBaseline = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', token)
      .send({ type: 'Limpieza', intervalMonths: 6 })
      .expect(201);
    expect([dateBefore, argentinaDate()]).toContain(currentBaseline.body.baselineDate);
    expect(currentBaseline.body).toMatchObject({
      type: 'Limpieza',
      intervalMonths: 6,
      intervalKm: null,
      baselineMileage: 48000,
    });

    await prisma.maintenance.createMany({
      data: [
        {
          vehicleId,
          type: 'Filtros',
          category: 'MANTENIMIENTO',
          date: new Date('2025-01-05T00:00:00.000Z'),
          mileage: 30000,
        },
        {
          vehicleId,
          type: 'fIlTrOs',
          category: 'MANTENIMIENTO',
          date: new Date('2025-08-12T00:00:00.000Z'),
          mileage: 42000,
        },
      ],
    });

    const maintenanceBaseline = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', token)
      .send({ type: 'FILTROS', intervalKm: 10000, intervalMonths: 12 })
      .expect(201);
    expect(maintenanceBaseline.body).toMatchObject({
      type: 'FILTROS',
      intervalKm: 10000,
      intervalMonths: 12,
      baselineDate: '2025-08-12',
      baselineMileage: 42000,
    });

    const fetched = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', token)
      .expect(200);
    expect(fetched.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: currentBaseline.body.id,
          type: 'Limpieza',
          intervalMonths: 6,
          intervalKm: null,
          baselineDate: currentBaseline.body.baselineDate,
          baselineMileage: 48000,
        }),
        expect.objectContaining({
          id: maintenanceBaseline.body.id,
          baselineDate: '2025-08-12',
          baselineMileage: 42000,
        }),
      ]),
    );
    expect(fetched.body).toHaveLength(2);
    expect(fetched.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: maintenanceBaseline.body.id,
          nextDueDate: '2026-08-12',
          nextDueMileage: 52000,
          remainingKm: 4000,
        }),
      ]),
    );
  });

  it('recomputes the status when the vehicle mileage changes, without touching the schedule', async () => {
    const path = `/vehicles/${vehicleId}/schedules`;
    const created = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', token)
      .send({ type: 'Aceite', intervalKm: 5000 })
      .expect(201);
    expect(created.body).toMatchObject({
      nextDueMileage: 53000,
      remainingKm: 5000,
      status: 'on_track',
    });

    const statusAt = async (mileage: number) => {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { mileage } });
      const listed = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', token)
        .expect(200);
      return listed.body.find((schedule: { id: string }) => schedule.id === created.body.id);
    };

    await expect(statusAt(51500)).resolves.toMatchObject({
      remainingKm: 1500,
      status: 'upcoming',
      dueReason: 'mileage',
    });
    await expect(statusAt(53000)).resolves.toMatchObject({
      remainingKm: 0,
      status: 'overdue',
      dueReason: 'mileage',
    });

    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', token)
      .send({ type: 'filtros', intervalKm: 5000 })
      .expect(409);
  });
});
