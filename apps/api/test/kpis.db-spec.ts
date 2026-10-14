import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { CreateKpiRunData, KpisRepository } from '../src/modules/kpis/kpis.repository';
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

describe('KPI persistence (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let repository: KpisRepository;
  const runIds: string[] = [];

  const windowStart = new Date('2026-10-12T03:00:00.000Z');
  const windowEnd = new Date('2026-10-13T03:00:00.000Z');

  function runData(overrides: Partial<CreateKpiRunData> = {}): CreateKpiRunData {
    const id = randomUUID();
    runIds.push(id);
    return {
      id,
      env: 'DEV',
      date: new Date('2026-10-12T00:00:00.000Z'),
      windowStart,
      windowEnd,
      calculationVersion: 'test-v1',
      status: 'COMPLETED',
      startedAt: new Date('2026-10-13T03:05:00.000Z'),
      finishedAt: new Date('2026-10-13T03:06:00.000Z'),
      results: [],
      ...overrides,
    };
  }

  const ready = (kpiId: string, value: number) => ({
    kpiId,
    status: 'READY' as const,
    value,
    windowStart,
    windowEnd,
  });

  async function rejectsWithCheck(promise: Promise<unknown>, constraint: string) {
    await expect(promise).rejects.toThrow(constraint);
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

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: jest.fn() })
      .compile();
    repository = moduleFixture.get(KpisRepository);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.kpiResult.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.kpiRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.$disconnect();
  });

  it('persists a run with READY, NO_DATA and ERROR results and reads it back by id', async () => {
    const data = runData({
      results: [
        { ...ready('error_rate', 0), numerator: 0n, denominator: 120n, sampleCount: 120n },
        {
          kpiId: 'p95_latency',
          status: 'NO_DATA',
          windowStart,
          windowEnd,
          diagnosticCode: 'NO_SAMPLES',
        },
        {
          kpiId: 'uptime',
          status: 'ERROR',
          windowStart,
          windowEnd,
          diagnosticCode: 'SOURCE_UNAVAILABLE',
        },
      ],
    });

    await repository.createRunWithResults(data);
    const run = await repository.findRunById(data.id);

    expect(run).toMatchObject({ id: data.id, env: 'DEV', status: 'COMPLETED' });
    expect(run?.results).toEqual([
      expect.objectContaining({
        kpiId: 'error_rate',
        status: 'READY',
        value: 0,
        denominator: 120n,
      }),
      expect.objectContaining({ kpiId: 'p95_latency', status: 'NO_DATA', value: null }),
      expect.objectContaining({ kpiId: 'uptime', status: 'ERROR', value: null }),
    ]);
    await expect(repository.findRunById(randomUUID())).resolves.toBeNull();
  });

  it('keeps two distinct runs for the same date and environment', async () => {
    const first = await repository.createRunWithResults(runData({ env: 'PROD' }));
    const second = await repository.createRunWithResults(runData({ env: 'PROD' }));

    const runs = await prisma.kpiRun.findMany({ where: { id: { in: [first.id, second.id] } } });
    expect(runs).toHaveLength(2);
  });

  it('rejects a duplicate run id without overwriting its results', async () => {
    const original = runData({ results: [ready('active_users', 10)] });
    await repository.createRunWithResults(original);

    await expect(
      repository.createRunWithResults({ ...original, results: [ready('active_users', 99)] }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const run = await repository.findRunById(original.id);
    expect(run?.results).toEqual([expect.objectContaining({ kpiId: 'active_users', value: 10 })]);
  });

  it('rejects a duplicate KPI in one run and leaves nothing persisted', async () => {
    const data = runData({ results: [ready('active_users', 1), ready('active_users', 2)] });

    await expect(repository.createRunWithResults(data)).rejects.toMatchObject({ code: 'P2002' });
    await expect(repository.findRunById(data.id)).resolves.toBeNull();
  });

  it('rolls back the run and every result when one result is invalid', async () => {
    const data = runData({
      results: [ready('active_users', 5), { ...ready('error_rate', 0.1), numerator: -1n }],
    });

    await rejectsWithCheck(repository.createRunWithResults(data), 'kpi_results_counts_check');
    await expect(repository.findRunById(data.id)).resolves.toBeNull();
    await expect(prisma.kpiResult.count({ where: { runId: data.id } })).resolves.toBe(0);
  });

  describe('result constraints', () => {
    let runId: string;

    beforeAll(async () => {
      runId = (await repository.createRunWithResults(runData())).id;
    });

    // Raw SQL so the database CHECK, not the Prisma client, is what rejects non-finite values.
    it.each(['NaN', 'Infinity', '-Infinity'])(
      'rejects a READY result with value %s',
      async (value) => {
        await rejectsWithCheck(
          prisma.$executeRaw`
          INSERT INTO "kpi_results" ("id", "runId", "kpiId", "status", "value", "windowStart", "windowEnd")
          VALUES (${randomUUID()}::uuid, ${runId}::uuid, ${`non_finite_${value}`}, 'READY',
                  ${value}::double precision, ${windowStart}, ${windowEnd})`,
          'kpi_results_value_status_check',
        );
      },
    );

    it.each([
      ['READY without a value', { kpiId: 'k', status: 'READY' as const, value: null }],
      ['NO_DATA with a value', { kpiId: 'k', status: 'NO_DATA' as const, value: 0 }],
      ['ERROR with a value', { kpiId: 'k', status: 'ERROR' as const, value: 1 }],
    ])('rejects %s', async (_label, result) => {
      await rejectsWithCheck(
        prisma.kpiResult.create({ data: { ...result, runId, windowStart, windowEnd } }),
        'kpi_results_value_status_check',
      );
    });

    it.each(['numerator', 'denominator', 'sampleCount'])('rejects a negative %s', async (field) => {
      await rejectsWithCheck(
        prisma.kpiResult.create({ data: { ...ready(`neg_${field}`, 1), runId, [field]: -1n } }),
        'kpi_results_counts_check',
      );
    });

    it('rejects a result window that does not end after it starts', async () => {
      await rejectsWithCheck(
        prisma.kpiResult.create({
          data: { ...ready('bad_window', 1), runId, windowStart: windowEnd, windowEnd },
        }),
        'kpi_results_window_check',
      );
    });

    it('rejects an orphan result', async () => {
      await expect(
        prisma.kpiResult.create({ data: { ...ready('orphan', 1), runId: randomUUID() } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('restricts deleting a run that has results', async () => {
      const run = await repository.createRunWithResults(runData({ results: [ready('kept', 1)] }));

      await expect(prisma.kpiRun.delete({ where: { id: run.id } })).rejects.toMatchObject({
        code: 'P2003',
      });
    });
  });

  it('rejects a run window that does not end after it starts', async () => {
    await rejectsWithCheck(
      repository.createRunWithResults(runData({ windowStart: windowEnd })),
      'kpi_runs_window_check',
    );
  });
});
