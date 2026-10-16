import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { calculateDailyKpis } from '../src/modules/kpis/kpi-calculations';
import { buildKpiWindows } from '../src/modules/kpis/kpi-dates';
import { KpisRepository } from '../src/modules/kpis/kpis.repository';
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

describe('Daily KPI source aggregation (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let repository: KpisRepository;
  const userIds: string[] = [];
  const vehicleIds: string[] = [];
  const requestLogIds: string[] = [];
  const windows = buildKpiWindows('2040-10-21');

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: jest.fn() })
      .compile();
    repository = module.get(KpisRepository);

    const firstUser = await prisma.user.create({
      data: {
        firebaseUid: `kpi-source-${randomUUID()}`,
        email: `kpi-source-${randomUUID()}@example.com`,
        name: 'KPI Source One',
      },
    });
    const secondUser = await prisma.user.create({
      data: {
        firebaseUid: `kpi-source-${randomUUID()}`,
        email: `kpi-source-${randomUUID()}@example.com`,
        name: 'KPI Source Two',
      },
    });
    userIds.push(firstUser.id, secondUser.id);

    for (const [ownerId, plate] of [
      [firstUser.id, `K${randomUUID().slice(0, 6)}`],
      [firstUser.id, `K${randomUUID().slice(0, 6)}`],
      [secondUser.id, `K${randomUUID().slice(0, 6)}`],
    ] as const) {
      const vehicle = await prisma.vehicle.create({
        data: {
          ownerId,
          brand: 'Test',
          model: 'KPI',
          year: 2026,
          fuel: 'NAFTA',
          plate,
          mileage: 10_000,
        },
      });
      vehicleIds.push(vehicle.id);
    }

    await prisma.maintenance.createMany({
      data: [
        {
          vehicleId: vehicleIds[0],
          type: 'Service 1',
          category: 'MANTENIMIENTO',
          date: new Date('2040-09-22T00:00:00.000Z'),
          mileage: 10_001,
          createdAt: new Date('2040-09-22T03:00:00.000Z'),
        },
        {
          vehicleId: vehicleIds[0],
          type: 'Service 2',
          category: 'MANTENIMIENTO',
          date: new Date('2040-10-01T00:00:00.000Z'),
          mileage: 10_002,
          createdAt: new Date('2040-10-01T12:00:00.000Z'),
        },
        {
          vehicleId: vehicleIds[1],
          type: 'Service 3',
          category: 'MANTENIMIENTO',
          date: new Date('2040-10-10T00:00:00.000Z'),
          mileage: 10_003,
          createdAt: new Date('2040-10-10T12:00:00.000Z'),
        },
        {
          vehicleId: vehicleIds[2],
          type: 'Repair 1',
          category: 'ARREGLO',
          date: new Date('2040-10-15T00:00:00.000Z'),
          mileage: 10_004,
          createdAt: new Date('2040-10-15T12:00:00.000Z'),
        },
        {
          vehicleId: vehicleIds[2],
          type: 'Repair 2',
          category: 'ARREGLO',
          date: new Date('2040-10-21T00:00:00.000Z'),
          mileage: 10_005,
          createdAt: new Date('2040-10-22T02:59:59.999Z'),
        },
        {
          vehicleId: vehicleIds[0],
          type: 'Old declared date',
          category: 'ARREGLO',
          date: new Date('2040-09-21T00:00:00.000Z'),
          mileage: 10_006,
          createdAt: new Date('2040-10-05T12:00:00.000Z'),
        },
        {
          vehicleId: vehicleIds[1],
          type: 'Open declared date',
          category: 'MANTENIMIENTO',
          date: new Date('2040-10-22T00:00:00.000Z'),
          mileage: 10_007,
          createdAt: new Date('2040-10-20T12:00:00.000Z'),
        },
        {
          vehicleId: vehicleIds[2],
          type: 'Registered at cutoff',
          category: 'MANTENIMIENTO',
          date: new Date('2040-10-21T00:00:00.000Z'),
          mileage: 10_008,
          createdAt: windows.windowEnd,
        },
      ],
    });

    const logs = [
      ['APPLICATION', 'COMPLETED', 200, 1, windows.windowStart],
      ['APPLICATION', 'COMPLETED', 200, 2, new Date('2040-10-21T10:00:00.000Z')],
      ['APPLICATION', 'COMPLETED', 200, 3, new Date('2040-10-21T11:00:00.000Z')],
      ['APPLICATION', 'COMPLETED', 500, 4, new Date('2040-10-22T02:59:59.999Z')],
      ['APPLICATION', 'ABORTED', null, 30, new Date('2040-10-21T12:00:00.000Z')],
      ['HEALTH', 'COMPLETED', 500, 900, new Date('2040-10-21T12:00:00.000Z')],
      ['REPORTING', 'COMPLETED', 500, 901, new Date('2040-10-21T12:00:00.000Z')],
      ['UNMATCHED', 'COMPLETED', 500, 902, new Date('2040-10-21T12:00:00.000Z')],
      ['APPLICATION', 'COMPLETED', 500, 999, windows.windowEnd],
    ] as const;

    for (const [trafficKind, outcome, statusCode, durationMs, startedAt] of logs) {
      const id = randomUUID();
      requestLogIds.push(id);
      await prisma.httpRequestLog.create({
        data: {
          id,
          method: 'GET',
          route: '/test',
          startedAt,
          endedAt: new Date(startedAt.getTime() + durationMs),
          durationMs,
          statusCode,
          outcome,
          trafficKind,
        },
      });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    if (requestLogIds.length > 0) {
      await prisma.httpRequestLog.deleteMany({ where: { id: { in: requestLogIds } } });
    }
    if (vehicleIds.length > 0) {
      await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it('uses the specified fields, boundaries and traffic population', async () => {
    const sources = await repository.readDailySources({
      windowStart: windows.windowStart,
      windowEnd: windows.windowEnd,
      thirtyDayWindowStart: windows.thirtyDayWindowStart,
    });

    expect(sources).toMatchObject({
      preventiveCount: 3n,
      maintenanceCount: 5n,
      serviceUserCount: 2n,
      activeVehicleCount: 3n,
    });
    expect(sources.httpRequests).toHaveLength(5);

    const calculation = calculateDailyKpis(sources, windows);
    expect(calculation.results[0]).toMatchObject({ value: 60, numerator: 3n, denominator: 5n });
    expect(calculation.results[4]).toMatchObject({ value: 25, numerator: 1n, denominator: 4n });
    expect(calculation.results[5]).toMatchObject({ value: 4, sampleCount: 4n });
    expect(calculation.abortedCount).toBe(1n);
  });
});
