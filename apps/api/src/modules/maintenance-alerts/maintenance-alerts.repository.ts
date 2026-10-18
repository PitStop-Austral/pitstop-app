import { Injectable } from '@nestjs/common';
import { MaintenanceAlertDeliveryStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addCalendarMonths } from '../schedules/schedule-due';
import { normalizeScheduleType } from '../schedules/schedule-type';
import {
  ALERT_RESOLUTION_RULE_VERSION,
  reconcileAlertResolutions,
} from './alert-cycle-evidence.repository';

const eligibleScheduleSelect = {
  id: true,
  type: true,
  intervalMonths: true,
  intervalKm: true,
  baselineDate: true,
  baselineMileage: true,
  vehicle: {
    select: {
      id: true,
      brand: true,
      model: true,
      nickname: true,
      plate: true,
      mileage: true,
      owner: {
        select: {
          id: true,
          upcomingThresholdDays: true,
          upcomingThresholdKm: true,
          notificationDevices: {
            select: { id: true, installationId: true, token: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ScheduleSelect;

const claimedDeliverySelect = {
  id: true,
  scheduleId: true,
  installationId: true,
  notificationDeviceId: true,
  dueKey: true,
} satisfies Prisma.MaintenanceAlertDeliverySelect;

const currentAlertScheduleSelect = {
  id: true,
  vehicleId: true,
  normalizedType: true,
  intervalMonths: true,
  intervalKm: true,
  baselineDate: true,
  baselineMileage: true,
  vehicle: { select: { ownerId: true } },
} satisfies Prisma.ScheduleSelect;

export type EligibleAlertSchedule = Prisma.ScheduleGetPayload<{
  select: typeof eligibleScheduleSelect;
}>;

export type MaintenanceAlertClaimInput = {
  scheduleId: string;
  installationId: string;
  notificationDeviceId: string;
  dueKey: string;
  dueDate: Date | null;
  dueMileage: number | null;
};

export type MaintenanceAlertClaimCandidate = MaintenanceAlertClaimInput & {
  ownerId: string;
  token: string;
  vehicleId: string;
  normalizedType: string;
};

export type LockedNotificationDevice = {
  id: string;
  ownerId: string;
  installationId: string;
  token: string;
};

export type MaintenanceAlertClaim = Prisma.MaintenanceAlertDeliveryGetPayload<{
  select: typeof claimedDeliverySelect;
}>;

type CurrentAlertSchedule = Prisma.ScheduleGetPayload<{
  select: typeof currentAlertScheduleSelect;
}>;

type AlertScheduleContext = Pick<
  MaintenanceAlertClaimCandidate,
  'scheduleId' | 'dueKey' | 'vehicleId' | 'normalizedType' | 'ownerId'
>;

export type SentAlertEvidence = Pick<
  MaintenanceAlertClaimInput,
  'scheduleId' | 'dueKey' | 'dueDate' | 'dueMileage'
> & {
  vehicleId: string;
  normalizedType: string;
  sentAt?: Date;
};

@Injectable()
export class MaintenanceAlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findEligibleSchedules(): Promise<EligibleAlertSchedule[]> {
    return this.prisma.schedule.findMany({
      where: {
        vehicle: {
          owner: {
            notificationsEnabled: true,
            notificationDevices: { some: {} },
          },
        },
      },
      select: eligibleScheduleSelect,
    });
  }

  claimDeliveries(data: MaintenanceAlertClaimCandidate[]): Promise<MaintenanceAlertClaim[]> {
    if (data.length === 0) return Promise.resolve([]);

    return this.prisma.$transaction(async (transaction) => {
      const deviceIds = [...new Set(data.map(({ notificationDeviceId }) => notificationDeviceId))];
      const scheduleIds = [...new Set(data.map(({ scheduleId }) => scheduleId))];
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "NotificationDevice" WHERE "id"::text IN (${Prisma.join(deviceIds)}) FOR UPDATE`,
      );
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Schedule" WHERE "id"::text IN (${Prisma.join(scheduleIds)}) ORDER BY "id" FOR UPDATE`,
      );
      const currentDevices = await transaction.notificationDevice.findMany({
        where: { id: { in: deviceIds } },
        select: { id: true, userId: true, installationId: true, token: true },
      });
      const currentDeviceKeys = new Set(
        currentDevices.map((device) =>
          this.deviceKey({
            id: device.id,
            ownerId: device.userId,
            installationId: device.installationId,
            token: device.token,
          }),
        ),
      );
      const currentSchedules = await transaction.schedule.findMany({
        where: { id: { in: scheduleIds } },
        select: currentAlertScheduleSelect,
      });
      const schedulesById = new Map(currentSchedules.map((schedule) => [schedule.id, schedule]));
      const claims = data.flatMap(({ ownerId, token, vehicleId, normalizedType, ...claim }) => {
        const schedule = schedulesById.get(claim.scheduleId);
        const deviceIsCurrent = currentDeviceKeys.has(
          this.deviceKey({
            id: claim.notificationDeviceId,
            ownerId,
            installationId: claim.installationId,
            token,
          }),
        );
        const scheduleIsCurrent = this.scheduleMatchesContext(schedule, {
          scheduleId: claim.scheduleId,
          dueKey: claim.dueKey,
          vehicleId,
          normalizedType,
          ownerId,
        });
        return deviceIsCurrent && scheduleIsCurrent ? [claim] : [];
      });
      if (claims.length === 0) return [];

      return transaction.maintenanceAlertDelivery.createManyAndReturn({
        data: claims,
        skipDuplicates: true,
        select: claimedDeliverySelect,
      });
    });
  }

  withCurrentDeviceLock<T>(
    device: LockedNotificationDevice,
    scheduleContext: AlertScheduleContext,
    action: () => Promise<T>,
  ): Promise<T | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id"::text AS "id"
            FROM "NotificationDevice"
            WHERE "id"::text = ${device.id}
              AND "userId"::text = ${device.ownerId}
              AND "installationId"::text = ${device.installationId}
              AND "token" = ${device.token}
            FOR UPDATE
          `,
        );
        if (rows.length === 0) return null;
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Schedule" WHERE "id" = ${scheduleContext.scheduleId}::uuid FOR UPDATE`,
        );
        const schedule = await transaction.schedule.findUnique({
          where: { id: scheduleContext.scheduleId },
          select: currentAlertScheduleSelect,
        });
        return this.scheduleMatchesContext(schedule, scheduleContext) ? action() : null;
      },
      { timeout: 30_000 },
    );
  }

  async markSent(id: string, fcmMessageId: string, evidence?: SentAlertEvidence): Promise<void> {
    const sentAt = evidence?.sentAt ?? new Date();
    await this.prisma.$transaction(async (transaction) => {
      const delivery = await transaction.maintenanceAlertDelivery.findUniqueOrThrow({
        where: { id },
      });
      if (delivery.status === MaintenanceAlertDeliveryStatus.SENT) return;
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Schedule" WHERE "id" = ${delivery.scheduleId}::uuid FOR UPDATE`,
      );
      const schedule = await transaction.schedule.findUnique({
        where: { id: delivery.scheduleId },
        select: {
          vehicleId: true,
          normalizedType: true,
          intervalMonths: true,
          intervalKm: true,
          baselineDate: true,
          baselineMileage: true,
          vehicle: { select: { mileage: true } },
        },
      });
      const observedAt = new Date();
      const snapshot =
        evidence ??
        (schedule
          ? {
              scheduleId: delivery.scheduleId,
              dueKey: delivery.dueKey,
              dueDate: delivery.dueDate,
              dueMileage: delivery.dueMileage,
              vehicleId: schedule.vehicleId,
              normalizedType: schedule.normalizedType,
            }
          : null);
      if (!snapshot) {
        // A pre-migration delivery whose schedule disappeared cannot be reconstructed.
        await transaction.maintenanceAlertDelivery.update({
          where: { id },
          data: { status: MaintenanceAlertDeliveryStatus.SENT, fcmMessageId, finishedAt: sentAt },
        });
        return;
      }
      const currentDueKey = schedule
        ? `${schedule.intervalMonths === null ? 'none' : addCalendarMonths(schedule.baselineDate, schedule.intervalMonths).toISOString().slice(0, 10)}:${schedule.intervalKm === null ? 'none' : schedule.baselineMileage + schedule.intervalKm}`
        : null;
      const canceled =
        !schedule ||
        currentDueKey !== snapshot.dueKey ||
        normalizeScheduleType(schedule.normalizedType) !== snapshot.normalizedType;
      await transaction.maintenanceAlertCycle.createMany({
        data: [
          {
            scheduleId: snapshot.scheduleId,
            dueKey: snapshot.dueKey,
            vehicleId: snapshot.vehicleId,
            normalizedType: snapshot.normalizedType,
            dueDate: snapshot.dueDate,
            dueMileage: snapshot.dueMileage,
            firstSentAt: sentAt,
            mileageReachedAt:
              snapshot.dueMileage !== null &&
              schedule &&
              schedule.vehicle.mileage >= snapshot.dueMileage
                ? observedAt
                : null,
            canceledAt: canceled ? observedAt : null,
            ruleVersion: ALERT_RESOLUTION_RULE_VERSION,
          },
        ],
        skipDuplicates: true,
      });
      const cycle = await transaction.maintenanceAlertCycle.findUniqueOrThrow({
        where: { scheduleId_dueKey: { scheduleId: snapshot.scheduleId, dueKey: snapshot.dueKey } },
      });
      await transaction.maintenanceAlertCycle.updateMany({
        where: { id: cycle.id, firstSentAt: { gt: sentAt } },
        data: { firstSentAt: sentAt },
      });
      if (
        snapshot.dueMileage !== null &&
        schedule &&
        schedule.vehicle.mileage >= snapshot.dueMileage
      ) {
        await transaction.maintenanceAlertCycle.updateMany({
          where: { id: cycle.id, mileageReachedAt: null },
          data: { mileageReachedAt: observedAt },
        });
      }
      await transaction.maintenanceAlertDelivery.update({
        where: { id },
        data: {
          cycleId: cycle.id,
          status: MaintenanceAlertDeliveryStatus.SENT,
          fcmMessageId,
          finishedAt: sentAt,
        },
      });
      await reconcileAlertResolutions(transaction, snapshot.vehicleId);
    });
  }

  async markFailed(id: string, errorCode: string): Promise<void> {
    await this.prisma.maintenanceAlertDelivery.update({
      where: { id },
      data: {
        status: MaintenanceAlertDeliveryStatus.FAILED,
        errorCode,
        finishedAt: new Date(),
      },
    });
  }

  async removeDeviceIfTokenMatches(id: string, token: string): Promise<void> {
    await this.prisma.notificationDevice.deleteMany({ where: { id, token } });
  }

  private deviceKey(device: LockedNotificationDevice): string {
    return `${device.id}:${device.ownerId}:${device.installationId}:${device.token}`;
  }

  private dueKey(dueDate: Date | null, dueMileage: number | null): string {
    return `${dueDate?.toISOString().slice(0, 10) ?? 'none'}:${dueMileage ?? 'none'}`;
  }

  private scheduleMatchesContext(
    schedule: CurrentAlertSchedule | null | undefined,
    context: AlertScheduleContext,
  ): boolean {
    if (!schedule) return false;
    const currentDueKey = this.dueKey(
      schedule.intervalMonths === null
        ? null
        : addCalendarMonths(schedule.baselineDate, schedule.intervalMonths),
      schedule.intervalKm === null ? null : schedule.baselineMileage + schedule.intervalKm,
    );
    return (
      schedule.id === context.scheduleId &&
      schedule.vehicleId === context.vehicleId &&
      schedule.vehicle.ownerId === context.ownerId &&
      normalizeScheduleType(schedule.normalizedType) === context.normalizedType &&
      currentDueKey === context.dueKey
    );
  }
}
