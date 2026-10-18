import type { KpiWindows } from './kpi-dates';

export const KPI_IDS = [
  'preventive_rate',
  'alert_resolution_rate',
  'service_users_30d',
  'active_vehicles_30d',
  'api_error_rate',
  'api_latency_p95',
] as const;

export type KpiId = (typeof KPI_IDS)[number];
export type CalculatedKpiStatus = 'READY' | 'NO_DATA' | 'ERROR';

export type DailyHttpRequestSource = {
  outcome: 'COMPLETED' | 'ABORTED';
  statusCode: number | null;
  durationMs: number;
};

export type DailyKpiSources = {
  alertResolution: {
    timelyCount: bigint;
    evaluableCount: bigint;
    evidenceMissing: boolean;
  };
  preventiveCount: bigint;
  maintenanceCount: bigint;
  serviceUserCount: bigint;
  activeVehicleCount: bigint;
  httpRequests: DailyHttpRequestSource[];
};

export type CalculatedKpiResult = {
  kpiId: KpiId;
  status: CalculatedKpiStatus;
  value: number | null;
  numerator: bigint | null;
  denominator: bigint | null;
  sampleCount: bigint | null;
  windowStart: Date;
  windowEnd: Date;
  diagnosticCode: string | null;
};

export type DailyKpiCalculation = {
  results: CalculatedKpiResult[];
  abortedCount: bigint;
};

function result(
  kpiId: KpiId,
  windowStart: Date,
  windowEnd: Date,
  values: Partial<CalculatedKpiResult>,
): CalculatedKpiResult {
  return {
    kpiId,
    status: 'READY',
    value: null,
    numerator: null,
    denominator: null,
    sampleCount: null,
    windowStart,
    windowEnd,
    diagnosticCode: null,
    ...values,
  };
}

export function calculateDailyKpis(
  sources: DailyKpiSources,
  windows: KpiWindows,
): DailyKpiCalculation {
  const thirtyDayWindow = [windows.thirtyDayWindowStart, windows.windowEnd] as const;
  const dailyWindow = [windows.windowStart, windows.windowEnd] as const;
  const completedRequests = sources.httpRequests.filter(
    (request) => request.outcome === 'COMPLETED',
  );
  const abortedCount = BigInt(sources.httpRequests.length - completedRequests.length);

  const preventive =
    sources.maintenanceCount === 0n
      ? result('preventive_rate', ...thirtyDayWindow, {
          status: 'NO_DATA',
          numerator: sources.preventiveCount,
          denominator: sources.maintenanceCount,
          diagnosticCode: 'NO_SERVICES',
        })
      : result('preventive_rate', ...thirtyDayWindow, {
          value: (100 * Number(sources.preventiveCount)) / Number(sources.maintenanceCount),
          numerator: sources.preventiveCount,
          denominator: sources.maintenanceCount,
        });

  const { timelyCount, evaluableCount, evidenceMissing } = sources.alertResolution;
  const alertResolution = evidenceMissing
    ? result('alert_resolution_rate', ...dailyWindow, {
        status: 'NO_DATA',
        diagnosticCode: 'ALERT_RESOLUTION_EVIDENCE_MISSING',
      })
    : evaluableCount === 0n
      ? result('alert_resolution_rate', ...dailyWindow, {
          status: 'NO_DATA',
          numerator: 0n,
          denominator: 0n,
          diagnosticCode: 'NO_EVALUABLE_ALERT_CYCLES',
        })
      : result('alert_resolution_rate', ...dailyWindow, {
          value: (100 * Number(timelyCount)) / Number(evaluableCount),
          numerator: timelyCount,
          denominator: evaluableCount,
        });

  const serviceUsers = result('service_users_30d', ...thirtyDayWindow, {
    value: Number(sources.serviceUserCount),
    sampleCount: sources.serviceUserCount,
  });
  const activeVehicles = result('active_vehicles_30d', ...thirtyDayWindow, {
    value: Number(sources.activeVehicleCount),
    sampleCount: sources.activeVehicleCount,
  });

  if (completedRequests.length === 0) {
    const noHttpData = {
      status: 'NO_DATA' as const,
      diagnosticCode: 'NO_HTTP_REQUESTS',
    };
    return {
      results: [
        preventive,
        alertResolution,
        serviceUsers,
        activeVehicles,
        result('api_error_rate', ...dailyWindow, {
          ...noHttpData,
          numerator: 0n,
          denominator: 0n,
        }),
        result('api_latency_p95', ...dailyWindow, {
          ...noHttpData,
          sampleCount: 0n,
        }),
      ],
      abortedCount,
    };
  }

  const serverErrorCount = BigInt(
    completedRequests.filter(
      ({ statusCode }) => statusCode !== null && statusCode >= 500 && statusCode < 600,
    ).length,
  );
  const completedCount = BigInt(completedRequests.length);
  const durations = completedRequests
    .map(({ durationMs }) => durationMs)
    .sort((left, right) => left - right);
  const p95Index = Math.ceil(0.95 * durations.length) - 1;

  return {
    results: [
      preventive,
      alertResolution,
      serviceUsers,
      activeVehicles,
      result('api_error_rate', ...dailyWindow, {
        value: (100 * Number(serverErrorCount)) / completedRequests.length,
        numerator: serverErrorCount,
        denominator: completedCount,
      }),
      result('api_latency_p95', ...dailyWindow, {
        value: durations[p95Index],
        sampleCount: completedCount,
      }),
    ],
    abortedCount,
  };
}
