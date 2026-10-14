import { Injectable } from '@nestjs/common';
import { MaintenanceAlertDeliveryStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "NotificationDevice" WHERE "id"::text IN (${Prisma.join(deviceIds)}) FOR UPDATE`,
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
      const claims = data.flatMap(({ ownerId, token, ...claim }) =>
        currentDeviceKeys.has(
          this.deviceKey({
            id: claim.notificationDeviceId,
            ownerId,
            installationId: claim.installationId,
            token,
          }),
        )
          ? [claim]
          : [],
      );
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
        return rows.length === 0 ? null : action();
      },
      { timeout: 30_000 },
    );
  }

  async markSent(id: string, fcmMessageId: string): Promise<void> {
    await this.prisma.maintenanceAlertDelivery.update({
      where: { id },
      data: {
        status: MaintenanceAlertDeliveryStatus.SENT,
        fcmMessageId,
        finishedAt: new Date(),
      },
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
}
