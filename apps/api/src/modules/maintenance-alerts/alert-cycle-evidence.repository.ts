import { Prisma } from '../../generated/prisma/client';
import { argentinaDate } from '../schedules/schedule-date';
import { normalizeScheduleType } from '../schedules/schedule-type';

export const ALERT_RESOLUTION_RULE_VERSION = '1';

type Transaction = Prisma.TransactionClient;

// Every writer that can change a cycle first locks its schedule rows in the same order.
export async function lockVehicleSchedules(
  transaction: Transaction,
  vehicleId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Schedule" WHERE "vehicleId" = ${vehicleId}::uuid ORDER BY "id" FOR UPDATE`,
  );
}

export async function observeAlertMileage(
  transaction: Transaction,
  vehicleId: string,
  mileage: number,
  observedAt: Date,
): Promise<void> {
  await transaction.maintenanceAlertCycle.updateMany({
    where: {
      vehicleId,
      canceledAt: null,
      mileageReachedAt: null,
      dueMileage: { lte: mileage },
      firstSentAt: { lte: observedAt },
    },
    data: { mileageReachedAt: observedAt },
  });
}

export async function cancelAlertCycles(
  transaction: Transaction,
  where: { scheduleId?: string; vehicleId?: string },
  canceledAt: Date,
): Promise<void> {
  await transaction.maintenanceAlertCycle.updateMany({
    where: { ...where, canceledAt: null },
    data: { canceledAt },
  });
}

// Rebuild live links after a service changes. Stored KPI runs are intentionally never modified.
export async function reconcileAlertResolutions(
  transaction: Transaction,
  vehicleId: string,
): Promise<void> {
  const [cycles, services] = await Promise.all([
    transaction.maintenanceAlertCycle.findMany({
      where: { vehicleId },
      orderBy: [{ firstSentAt: 'asc' }, { id: 'asc' }],
    }),
    transaction.maintenance.findMany({
      where: { vehicleId },
      select: { id: true, type: true, date: true, mileage: true, createdAt: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const assigned = new Set<string>();
  const serviceMatchesCycle = (
    service: (typeof services)[number],
    cycle: (typeof cycles)[number],
  ): boolean => {
    const sentDay = argentinaDate(cycle.firstSentAt);
    const nextCycle = cycles.find(
      (candidate) =>
        candidate.scheduleId === cycle.scheduleId && candidate.firstSentAt > cycle.firstSentAt,
    );
    const nextSentDay = nextCycle ? argentinaDate(nextCycle.firstSentAt) : undefined;
    return (
      normalizeScheduleType(service.type) === cycle.normalizedType &&
      service.createdAt >= cycle.firstSentAt &&
      service.date >= sentDay &&
      (nextSentDay === undefined || service.date < nextSentDay)
    );
  };

  for (const cycle of cycles.filter(({ canceledAt }) => canceledAt !== null)) {
    if (!cycle.resolvedMaintenanceId) continue;
    const service = services.find(
      (candidate) =>
        candidate.id === cycle.resolvedMaintenanceId && serviceMatchesCycle(candidate, cycle),
    );
    if (service) assigned.add(service.id);
    const unchanged =
      service?.id === cycle.resolvedMaintenanceId &&
      service.date.getTime() === cycle.resolvedServiceDate?.getTime() &&
      service.mileage === cycle.resolvedServiceMileage;
    if (unchanged) continue;
    await transaction.maintenanceAlertCycle.update({
      where: { id: cycle.id },
      data: {
        resolvedMaintenanceId: service?.id ?? null,
        resolvedServiceDate: service?.date ?? null,
        resolvedServiceMileage: service?.mileage ?? null,
        resolvedAt: service ? new Date() : null,
      },
    });
  }

  for (const cycle of cycles.filter(({ canceledAt }) => canceledAt === null)) {
    const service = services.find(
      (candidate) => !assigned.has(candidate.id) && serviceMatchesCycle(candidate, cycle),
    );
    if (service) assigned.add(service.id);
    const unchanged =
      service?.id === cycle.resolvedMaintenanceId &&
      service.date.getTime() === cycle.resolvedServiceDate?.getTime() &&
      service.mileage === cycle.resolvedServiceMileage;
    if (unchanged || (!service && cycle.resolvedMaintenanceId === null)) continue;
    await transaction.maintenanceAlertCycle.update({
      where: { id: cycle.id },
      data: {
        resolvedMaintenanceId: service?.id ?? null,
        resolvedServiceDate: service?.date ?? null,
        resolvedServiceMileage: service?.mileage ?? null,
        resolvedAt: service ? (unchanged ? cycle.resolvedAt : new Date()) : null,
      },
    });
  }
}
