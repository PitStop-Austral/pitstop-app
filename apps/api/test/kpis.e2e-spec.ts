import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { KPI_CLOCK } from '../src/modules/kpis/kpi.service';
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

describe('Daily KPI endpoint (e2e)', () => {
  let app: INestApplication<App>;
  let readDailySources: jest.Mock;
  let createRunWithResults: jest.Mock;
  let verifyIdToken: jest.Mock;

  const sourceData = {
    alertResolution: {
      timelyCount: 0n,
      evaluableCount: 0n,
      missingDeliveryCount: 1n,
      incompleteCycleCount: 2n,
    },
    preventiveCount: 3n,
    maintenanceCount: 5n,
    serviceUserCount: 2n,
    activeVehicleCount: 3n,
    httpRequests: [
      { outcome: 'COMPLETED' as const, statusCode: 200, durationMs: 10 },
      { outcome: 'COMPLETED' as const, statusCode: 500, durationMs: 20 },
      { outcome: 'ABORTED' as const, statusCode: null, durationMs: 30 },
    ],
  };

  beforeEach(async () => {
    delete process.env.CRON_SECRET;
    readDailySources = jest.fn().mockResolvedValue(sourceData);
    createRunWithResults = jest.fn().mockResolvedValue(undefined);
    verifyIdToken = jest.fn();

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken })
      .overrideProvider(KpisRepository)
      .useValue({ readDailySources, createRunWithResults })
      .overrideProvider(KPI_CLOCK)
      .useValue({ now: () => new Date('2026-10-22T12:00:00.000Z') })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    delete process.env.CRON_SECRET;
    await app.close();
  });

  it('returns and persists a protected snapshot without invoking Firebase', async () => {
    process.env.CRON_SECRET = 'expected-secret';

    const response = await request(app.getHttpServer())
      .get('/internal/kpis/daily?date=2026-10-21&env=dev')
      .set('Authorization', 'Bearer expected-secret')
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toMatchObject({
      date: '2026-10-21',
      env: 'dev',
      calculationVersion: '2',
      measurements: expect.arrayContaining([
        { kpi_id: 'preventive_rate', value: 60 },
        { kpi_id: 'api_error_rate', value: 50 },
      ]),
    });
    expect(response.body.diagnostics).toHaveLength(6);
    expect(response.body.diagnostics[1]).toMatchObject({
      diagnosticCode: 'ALERT_RESOLUTION_EVIDENCE_MISSING',
      numerator: '1',
      denominator: '2',
      sampleCount: '3',
    });
    expect(createRunWithResults).toHaveBeenCalledTimes(1);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    ['without CRON_SECRET configured', undefined, 'Bearer expected-secret'],
    ['without a credential', 'expected-secret', undefined],
    ['with an invalid credential', 'expected-secret', 'Bearer wrong-secret'],
  ])('returns 401 %s', async (_label, secret, authorization) => {
    if (secret) process.env.CRON_SECRET = secret;
    const pendingRequest = request(app.getHttpServer()).get(
      '/internal/kpis/daily?date=2026-10-21&env=dev',
    );
    if (authorization) pendingRequest.set('Authorization', authorization);

    await pendingRequest.expect(401);

    expect(readDailySources).not.toHaveBeenCalled();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    '/internal/kpis/daily?env=dev',
    '/internal/kpis/daily?date=2026-02-30&env=dev',
    '/internal/kpis/daily?date=2026-10-22&env=dev',
    '/internal/kpis/daily?date=2026-10-21',
    '/internal/kpis/daily?date=2026-10-21&env=staging',
    '/internal/kpis/daily?date=2026-10-21&env=dev&projectKey=secret',
  ])('returns 400 without persistence for invalid query %s', async (url) => {
    process.env.CRON_SECRET = 'expected-secret';

    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', 'Bearer expected-secret')
      .expect(400);

    expect(createRunWithResults).not.toHaveBeenCalled();
  });

  it('returns a safe 503 when source collection fails', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    readDailySources.mockRejectedValue(new Error('password=secret'));

    const response = await request(app.getHttpServer())
      .get('/internal/kpis/daily?date=2026-10-21&env=prod')
      .set('Authorization', 'Bearer expected-secret')
      .expect(503);

    expect(response.body.message).toBe('KPI snapshot unavailable');
    expect(JSON.stringify(response.body)).not.toContain('password=secret');
    expect(createRunWithResults).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', env: 'PROD' }),
    );
  });
});
