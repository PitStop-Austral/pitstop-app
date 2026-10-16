import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  calculateDailyKpis,
  KPI_IDS,
  type CalculatedKpiResult,
  type DailyKpiCalculation,
  type KpiId,
} from './kpi-calculations';
import { buildKpiWindows, dateKeyInArgentina, type KpiWindows } from './kpi-dates';
import type { DailyKpiEnvironment, DailyKpisQueryDto } from './dto/daily-kpis-query.dto';
import { KpisRepository, type CreateKpiRunData } from './kpis.repository';

const CALCULATION_VERSION = '1';

export type KpiClock = { now(): Date };
export const KPI_CLOCK = Symbol('KPI_CLOCK');
export const systemKpiClock: KpiClock = { now: () => new Date() };

export type DailyKpiMeasurement = { kpi_id: KpiId; value: number };

export type DailyKpiDiagnostic = {
  kpi_id: KpiId;
  status: CalculatedKpiResult['status'];
  windowStart: string;
  windowEnd: string;
  numerator?: string;
  denominator?: string;
  sampleCount?: string;
  diagnosticCode?: string;
  abortedCount?: string;
};

export type DailyKpisResponse = {
  runId: string;
  date: string;
  env: DailyKpiEnvironment;
  calculationVersion: string;
  windowStart: string;
  windowEnd: string;
  measurements: DailyKpiMeasurement[];
  diagnostics: DailyKpiDiagnostic[];
};

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  constructor(
    private readonly kpisRepository: KpisRepository,
    @Inject(KPI_CLOCK) private readonly clock: KpiClock,
  ) {}

  async calculateDaily(query: DailyKpisQueryDto): Promise<DailyKpisResponse> {
    const startedAt = this.clock.now();
    if (query.date >= dateKeyInArgentina(startedAt)) {
      throw new BadRequestException('Date must be a closed Argentine calendar day');
    }

    const runId = randomUUID();
    const windows = buildKpiWindows(query.date);
    let calculation: DailyKpiCalculation;

    try {
      const sources = await this.kpisRepository.readDailySources({
        windowStart: windows.windowStart,
        windowEnd: windows.windowEnd,
        thirtyDayWindowStart: windows.thirtyDayWindowStart,
      });
      calculation = calculateDailyKpis(sources, windows);
    } catch {
      await this.tryPersistFailedRun(runId, query, windows, startedAt);
      this.logger.error({
        message: 'KPI source query failed',
        runId,
        errorCode: 'SOURCE_UNAVAILABLE',
      });
      throw new ServiceUnavailableException('KPI snapshot unavailable');
    }

    try {
      await this.kpisRepository.createRunWithResults({
        id: runId,
        env: this.toStoredEnvironment(query.env),
        date: windows.date,
        windowStart: windows.windowStart,
        windowEnd: windows.windowEnd,
        calculationVersion: CALCULATION_VERSION,
        status: 'COMPLETED',
        startedAt,
        finishedAt: this.clock.now(),
        results: calculation.results,
      });
    } catch {
      this.logger.error({
        message: 'KPI snapshot persistence failed',
        runId,
        errorCode: 'PERSISTENCE_FAILED',
      });
      throw new ServiceUnavailableException('KPI snapshot unavailable');
    }

    return this.toResponse(runId, query, windows, calculation);
  }

  private async tryPersistFailedRun(
    runId: string,
    query: DailyKpisQueryDto,
    windows: KpiWindows,
    startedAt: Date,
  ): Promise<void> {
    const data: CreateKpiRunData = {
      id: runId,
      env: this.toStoredEnvironment(query.env),
      date: windows.date,
      windowStart: windows.windowStart,
      windowEnd: windows.windowEnd,
      calculationVersion: CALCULATION_VERSION,
      status: 'FAILED',
      startedAt,
      finishedAt: this.clock.now(),
      errorCode: 'SOURCE_UNAVAILABLE',
      results: KPI_IDS.map((kpiId) => ({
        kpiId,
        status: 'ERROR',
        value: null,
        windowStart: this.isThirtyDayKpi(kpiId)
          ? windows.thirtyDayWindowStart
          : windows.windowStart,
        windowEnd: windows.windowEnd,
        diagnosticCode: 'SOURCE_UNAVAILABLE',
      })),
    };

    try {
      await this.kpisRepository.createRunWithResults(data);
    } catch {
      this.logger.error({
        message: 'Failed KPI run could not be persisted',
        runId,
        errorCode: 'PERSISTENCE_FAILED',
      });
    }
  }

  private toResponse(
    runId: string,
    query: DailyKpisQueryDto,
    windows: KpiWindows,
    calculation: DailyKpiCalculation,
  ): DailyKpisResponse {
    return {
      runId,
      date: query.date,
      env: query.env,
      calculationVersion: CALCULATION_VERSION,
      windowStart: windows.windowStart.toISOString(),
      windowEnd: windows.windowEnd.toISOString(),
      measurements: calculation.results.flatMap((result) =>
        result.status === 'READY' && result.value !== null
          ? [{ kpi_id: result.kpiId, value: result.value }]
          : [],
      ),
      diagnostics: calculation.results.map((result) => ({
        kpi_id: result.kpiId,
        status: result.status,
        windowStart: result.windowStart.toISOString(),
        windowEnd: result.windowEnd.toISOString(),
        ...(result.numerator === null ? {} : { numerator: result.numerator.toString() }),
        ...(result.denominator === null ? {} : { denominator: result.denominator.toString() }),
        ...(result.sampleCount === null ? {} : { sampleCount: result.sampleCount.toString() }),
        ...(result.diagnosticCode === null ? {} : { diagnosticCode: result.diagnosticCode }),
        ...(this.isHttpKpi(result.kpiId)
          ? { abortedCount: calculation.abortedCount.toString() }
          : {}),
      })),
    };
  }

  private toStoredEnvironment(environment: DailyKpiEnvironment): 'DEV' | 'PROD' {
    return environment === 'dev' ? 'DEV' : 'PROD';
  }

  private isThirtyDayKpi(kpiId: KpiId): boolean {
    return (
      kpiId === 'preventive_rate' ||
      kpiId === 'service_users_30d' ||
      kpiId === 'active_vehicles_30d'
    );
  }

  private isHttpKpi(kpiId: KpiId): boolean {
    return kpiId === 'api_error_rate' || kpiId === 'api_latency_p95';
  }
}
