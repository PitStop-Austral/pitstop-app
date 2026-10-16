import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DailyKpiSources } from './kpi-calculations';

const runWithResults = {
  results: { orderBy: { kpiId: 'asc' } },
} satisfies Prisma.KpiRunInclude;

export type KpiRunWithResults = Prisma.KpiRunGetPayload<{ include: typeof runWithResults }>;

// The caller supplies the run id so a retry reuses it; a duplicate id or (runId, kpiId) fails with P2002.
export type CreateKpiRunData = Omit<Prisma.KpiRunCreateInput, 'id' | 'results'> & {
  id: string;
  results: Prisma.KpiResultCreateManyRunInput[];
};

export type ReadDailyKpiSourcesInput = {
  windowStart: Date;
  windowEnd: Date;
  thirtyDayWindowStart: Date;
};

@Injectable()
export class KpisRepository {
  constructor(private readonly prisma: PrismaService) {}

  readDailySources({
    windowStart,
    windowEnd,
    thirtyDayWindowStart,
  }: ReadDailyKpiSourcesInput): Promise<DailyKpiSources> {
    const maintenanceDateStart = new Date(
      `${thirtyDayWindowStart.toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const maintenanceDateEnd = new Date(`${windowEnd.toISOString().slice(0, 10)}T00:00:00.000Z`);

    return this.prisma.$transaction(
      async (transaction) => {
        const [maintenanceCount, preventiveCount, activeMaintenances, httpRequests] =
          await Promise.all([
            transaction.maintenance.count({
              where: {
                date: { gte: maintenanceDateStart, lt: maintenanceDateEnd },
                createdAt: { lt: windowEnd },
              },
            }),
            transaction.maintenance.count({
              where: {
                category: 'MANTENIMIENTO',
                date: { gte: maintenanceDateStart, lt: maintenanceDateEnd },
                createdAt: { lt: windowEnd },
              },
            }),
            transaction.maintenance.findMany({
              where: { createdAt: { gte: thirtyDayWindowStart, lt: windowEnd } },
              distinct: ['vehicleId'],
              select: { vehicleId: true, vehicle: { select: { ownerId: true } } },
            }),
            transaction.httpRequestLog.findMany({
              where: {
                trafficKind: 'APPLICATION',
                startedAt: { gte: windowStart, lt: windowEnd },
              },
              select: { outcome: true, statusCode: true, durationMs: true },
            }),
          ]);

        return {
          preventiveCount: BigInt(preventiveCount),
          maintenanceCount: BigInt(maintenanceCount),
          serviceUserCount: BigInt(
            new Set(activeMaintenances.map(({ vehicle }) => vehicle.ownerId)).size,
          ),
          activeVehicleCount: BigInt(activeMaintenances.length),
          httpRequests,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  // A nested create runs in a single transaction: either the run and every result persist, or nothing does.
  createRunWithResults({ results, ...run }: CreateKpiRunData): Promise<KpiRunWithResults> {
    return this.prisma.kpiRun.create({
      data: { ...run, results: { createMany: { data: results } } },
      include: runWithResults,
    });
  }

  findRunById(id: string): Promise<KpiRunWithResults | null> {
    return this.prisma.kpiRun.findUnique({ where: { id }, include: runWithResults });
  }
}
