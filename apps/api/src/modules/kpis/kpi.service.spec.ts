import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { KPI_CLOCK, KpiService, type KpiClock } from './kpi.service';
import { KpisRepository } from './kpis.repository';

describe('KpiService', () => {
  let service: KpiService;
  let readDailySources: jest.Mock;
  let createRunWithResults: jest.Mock;
  const clock: KpiClock = { now: () => new Date('2026-10-22T12:00:00.000Z') };

  const sourceData = {
    alertResolution: { timelyCount: 0n, evaluableCount: 0n, evidenceMissing: true },
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
    readDailySources = jest.fn().mockResolvedValue(sourceData);
    createRunWithResults = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        KpiService,
        {
          provide: KpisRepository,
          useValue: { readDailySources, createRunWithResults },
        },
        { provide: KPI_CLOCK, useValue: clock },
      ],
    }).compile();

    service = module.get(KpiService);
  });

  it.each(['2026-10-22', '2026-10-23'])(
    'rejects the open or future date %s before reading or persisting',
    async (date) => {
      await expect(service.calculateDaily({ date, env: 'dev' })).rejects.toThrow(
        BadRequestException,
      );
      expect(readDailySources).not.toHaveBeenCalled();
      expect(createRunWithResults).not.toHaveBeenCalled();
    },
  );

  it('persists six results and returns only READY measurements with string evidence', async () => {
    const response = await service.calculateDaily({ date: '2026-10-21', env: 'dev' });

    expect(response).toMatchObject({
      runId: expect.any(String),
      date: '2026-10-21',
      env: 'dev',
      calculationVersion: '2',
      windowStart: '2026-10-21T03:00:00.000Z',
      windowEnd: '2026-10-22T03:00:00.000Z',
    });
    expect(response.measurements).toEqual([
      { kpi_id: 'preventive_rate', value: 60 },
      { kpi_id: 'service_users_30d', value: 2 },
      { kpi_id: 'active_vehicles_30d', value: 3 },
      { kpi_id: 'api_error_rate', value: 50 },
      { kpi_id: 'api_latency_p95', value: 20 },
    ]);
    expect(response.diagnostics).toHaveLength(6);
    expect(response.diagnostics[0]).toMatchObject({
      kpi_id: 'preventive_rate',
      status: 'READY',
      numerator: '3',
      denominator: '5',
    });
    expect(response.diagnostics[1]).toMatchObject({
      kpi_id: 'alert_resolution_rate',
      status: 'NO_DATA',
      diagnosticCode: 'ALERT_RESOLUTION_EVIDENCE_MISSING',
    });
    expect(response.diagnostics[4]).toMatchObject({
      kpi_id: 'api_error_rate',
      abortedCount: '1',
    });
    expect(response.diagnostics[5]).toMatchObject({
      kpi_id: 'api_latency_p95',
      abortedCount: '1',
    });

    expect(readDailySources).toHaveBeenCalledWith({
      windowStart: new Date('2026-10-21T03:00:00.000Z'),
      windowEnd: new Date('2026-10-22T03:00:00.000Z'),
      thirtyDayWindowStart: new Date('2026-09-22T03:00:00.000Z'),
    });
    expect(createRunWithResults).toHaveBeenCalledWith(
      expect.objectContaining({
        id: response.runId,
        env: 'DEV',
        date: new Date('2026-10-21T00:00:00.000Z'),
        status: 'COMPLETED',
        calculationVersion: '2',
        results: expect.arrayContaining([
          expect.objectContaining({ kpiId: 'preventive_rate', value: 60 }),
          expect.objectContaining({
            kpiId: 'alert_resolution_rate',
            status: 'NO_DATA',
            value: null,
          }),
        ]),
      }),
    );
    expect(createRunWithResults.mock.calls[0][0].results).toHaveLength(6);
  });

  it('attempts to preserve a FAILED run when a source query fails', async () => {
    readDailySources.mockRejectedValue(new Error('database password=secret'));

    await expect(service.calculateDaily({ date: '2026-10-21', env: 'prod' })).rejects.toThrow(
      ServiceUnavailableException,
    );

    expect(createRunWithResults).toHaveBeenCalledWith(
      expect.objectContaining({
        env: 'PROD',
        status: 'FAILED',
        errorCode: 'SOURCE_UNAVAILABLE',
      }),
    );
    const failedResults = createRunWithResults.mock.calls[0][0].results;
    expect(failedResults).toHaveLength(6);
    expect(failedResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'ERROR',
          value: null,
          diagnosticCode: 'SOURCE_UNAVAILABLE',
        }),
      ]),
    );
    expect(JSON.stringify(failedResults)).not.toContain('password=secret');
  });

  it('returns a safe 503 without claiming persistence when the completed run cannot be saved', async () => {
    createRunWithResults.mockRejectedValue(new Error('database unavailable: password=secret'));

    await expect(service.calculateDaily({ date: '2026-10-21', env: 'dev' })).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'KPI snapshot unavailable' }),
    });
    expect(createRunWithResults).toHaveBeenCalledTimes(1);
  });
});
