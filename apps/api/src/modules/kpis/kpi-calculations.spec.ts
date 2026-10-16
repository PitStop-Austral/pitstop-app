import {
  calculateDailyKpis,
  type DailyHttpRequestSource,
  type DailyKpiSources,
} from './kpi-calculations';
import { buildKpiWindows } from './kpi-dates';

const windows = buildKpiWindows('2026-10-21');

function sources(overrides: Partial<DailyKpiSources> = {}): DailyKpiSources {
  return {
    preventiveCount: 3n,
    maintenanceCount: 5n,
    serviceUserCount: 2n,
    activeVehicleCount: 3n,
    httpRequests: [],
    ...overrides,
  };
}

describe('daily KPI calculations', () => {
  it('calculates the six ordered KPI results from known data', () => {
    const httpRequests: DailyHttpRequestSource[] = Array.from({ length: 20 }, (_, index) => ({
      outcome: 'COMPLETED' as const,
      statusCode: index === 19 ? 500 : 200,
      durationMs: index + 1,
    }));
    httpRequests.push({ outcome: 'ABORTED', statusCode: null, durationMs: 500 });

    const calculation = calculateDailyKpis(sources({ httpRequests }), windows);

    expect(calculation.results).toEqual([
      expect.objectContaining({
        kpiId: 'preventive_rate',
        status: 'READY',
        value: 60,
        numerator: 3n,
        denominator: 5n,
        windowStart: windows.thirtyDayWindowStart,
      }),
      expect.objectContaining({
        kpiId: 'alert_resolution_rate',
        status: 'NO_DATA',
        value: null,
        diagnosticCode: 'ALERT_RESOLUTION_EVIDENCE_MISSING',
        windowStart: windows.windowStart,
      }),
      expect.objectContaining({
        kpiId: 'service_users_30d',
        status: 'READY',
        value: 2,
        sampleCount: 2n,
      }),
      expect.objectContaining({
        kpiId: 'active_vehicles_30d',
        status: 'READY',
        value: 3,
        sampleCount: 3n,
      }),
      expect.objectContaining({
        kpiId: 'api_error_rate',
        status: 'READY',
        value: 5,
        numerator: 1n,
        denominator: 20n,
      }),
      expect.objectContaining({
        kpiId: 'api_latency_p95',
        status: 'READY',
        value: 19,
        sampleCount: 20n,
      }),
    ]);
    expect(calculation.abortedCount).toBe(1n);
  });

  it.each([
    [0n, 2n, 0],
    [2n, 2n, 100],
  ])('keeps a measured preventive ratio of %s/%s as READY', (preventive, total, value) => {
    const [result] = calculateDailyKpis(
      sources({ preventiveCount: preventive, maintenanceCount: total }),
      windows,
    ).results;

    expect(result).toMatchObject({ status: 'READY', value });
  });

  it('distinguishes successful zero counts from missing ratio and HTTP data', () => {
    const calculation = calculateDailyKpis(
      sources({
        preventiveCount: 0n,
        maintenanceCount: 0n,
        serviceUserCount: 0n,
        activeVehicleCount: 0n,
        httpRequests: [{ outcome: 'ABORTED', statusCode: null, durationMs: 12 }],
      }),
      windows,
    );

    expect(calculation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiId: 'preventive_rate',
          status: 'NO_DATA',
          diagnosticCode: 'NO_SERVICES',
        }),
        expect.objectContaining({ kpiId: 'service_users_30d', status: 'READY', value: 0 }),
        expect.objectContaining({ kpiId: 'active_vehicles_30d', status: 'READY', value: 0 }),
        expect.objectContaining({
          kpiId: 'api_error_rate',
          status: 'NO_DATA',
          diagnosticCode: 'NO_HTTP_REQUESTS',
        }),
        expect.objectContaining({
          kpiId: 'api_latency_p95',
          status: 'NO_DATA',
          diagnosticCode: 'NO_HTTP_REQUESTS',
        }),
      ]),
    );
    expect(calculation.abortedCount).toBe(1n);
  });

  it('uses the only completed duration as p95 and ignores 4xx for the error numerator', () => {
    const calculation = calculateDailyKpis(
      sources({
        httpRequests: [
          { outcome: 'COMPLETED', statusCode: 404, durationMs: 120 },
          { outcome: 'ABORTED', statusCode: null, durationMs: 999 },
        ],
      }),
      windows,
    );

    expect(calculation.results[4]).toMatchObject({ value: 0, numerator: 0n, denominator: 1n });
    expect(calculation.results[5]).toMatchObject({ value: 120, sampleCount: 1n });
  });
});
