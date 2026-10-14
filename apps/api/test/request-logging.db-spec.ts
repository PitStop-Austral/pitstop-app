import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { RequestLoggingMiddleware } from '../src/modules/request-logging/request-logging.middleware';
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

describe('HTTP request logging persistence (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let userId: string;
  const requestLogIds: string[] = [];
  const vehicleIds: string[] = [];
  const firebaseUid = `request-logging-${randomUUID()}`;
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
      data: { firebaseUid, email, name: 'Request Logging Test Driver' },
    });
    userId = user.id;

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: firebaseUid, email }) })
      .compile();

    app = moduleFixture.createNestApplication();
    const requestLogging = app.get(RequestLoggingMiddleware);
    app.use(requestLogging.use.bind(requestLogging));
    app.enableCors({ origin: 'http://localhost:3000' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (requestLogIds.length > 0) {
      await prisma.httpRequestLog.deleteMany({ where: { id: { in: requestLogIds } } });
    }
    if (vehicleIds.length > 0) {
      await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (prisma) await prisma.$disconnect();
  });

  async function logsSince(startedAt: Date, expectedCount: number) {
    let rows = [] as Awaited<ReturnType<typeof prisma.httpRequestLog.findMany>>;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      rows = await prisma.httpRequestLog.findMany({
        where: { startedAt: { gte: startedAt } },
        orderBy: { startedAt: 'asc' },
      });
      if (rows.length >= expectedCount) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    requestLogIds.push(...rows.map((row) => row.id));
    return rows;
  }

  it('persists exactly five completed requests, including two 5xx responses', async () => {
    const startedAt = new Date();

    await request(app.getHttpServer()).get('/').expect(200);
    const created = await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', token)
      .send({
        brand: 'Honda',
        model: 'Civic',
        year: 2021,
        fuel: 'NAFTA',
        plate: 'AB123CD',
        mileage: 48000,
        nickname: 'body-secret',
      })
      .expect(201);
    vehicleIds.push(created.body.id);
    await request(app.getHttpServer())
      .post('/vehicles')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);

    const findMany = jest
      .spyOn(prisma.vehicle, 'findMany')
      .mockRejectedValueOnce(new Error('test'));
    await request(app.getHttpServer()).get('/vehicles').set('Authorization', token).expect(500);
    findMany.mockRestore();

    const queryRaw = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('test'));
    await request(app.getHttpServer()).get('/health/db').expect(503);
    queryRaw.mockRestore();

    const rows = await logsSince(startedAt, 5);
    expect(rows).toHaveLength(5);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          route: '/',
          statusCode: 200,
          trafficKind: 'APPLICATION',
        }),
        expect.objectContaining({
          method: 'POST',
          route: '/vehicles',
          statusCode: 201,
          trafficKind: 'APPLICATION',
        }),
        expect.objectContaining({
          method: 'POST',
          route: null,
          statusCode: 400,
          trafficKind: 'UNMATCHED',
        }),
        expect.objectContaining({
          method: 'GET',
          route: '/vehicles',
          statusCode: 500,
          trafficKind: 'APPLICATION',
        }),
        expect.objectContaining({
          method: 'GET',
          route: '/health/db',
          statusCode: 503,
          trafficKind: 'HEALTH',
        }),
      ]),
    );
    expect(rows.filter((row) => (row.statusCode ?? 0) >= 500)).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ outcome: 'COMPLETED' })]),
    );
    expect(rows.every((row) => row.durationMs >= 0)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('body-secret');
    expect(JSON.stringify(rows)).not.toContain('test-token');
  });

  it('persists safe normalized rows for authentication, unmatched, and preflight requests', async () => {
    const startedAt = new Date();

    await request(app.getHttpServer())
      .get('/vehicles?vehicleId=secret-query')
      .set('Cookie', 'session=secret-cookie')
      .expect(401);
    await request(app.getHttpServer())
      .get('/missing?token=secret-query')
      .set('Cookie', 'session=secret-cookie')
      .expect(404);
    await request(app.getHttpServer())
      .options('/vehicles')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    const rows = await logsSince(startedAt, 3);
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          route: '/vehicles',
          statusCode: 401,
          trafficKind: 'APPLICATION',
        }),
        expect.objectContaining({
          method: 'GET',
          route: null,
          statusCode: 404,
          trafficKind: 'UNMATCHED',
        }),
        expect.objectContaining({
          method: 'OPTIONS',
          route: null,
          statusCode: 204,
          trafficKind: 'UNMATCHED',
        }),
      ]),
    );
    for (const row of rows) {
      expect(row).toMatchObject({ outcome: 'COMPLETED' });
      expect(row).not.toHaveProperty('query');
      expect(row).not.toHaveProperty('headers');
      expect(row).not.toHaveProperty('body');
      expect(row).not.toHaveProperty('ip');
    }
    expect(JSON.stringify(rows)).not.toContain('secret-query');
    expect(JSON.stringify(rows)).not.toContain('secret-cookie');
  });
});
