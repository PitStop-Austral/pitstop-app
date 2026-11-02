import { Injectable } from '@nestjs/common';
import { MaintenanceAlertDeliveryStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  disableNotificationsWithoutDevices,
  lockNotificationDeviceMutations,
} from '../notifications/notification-device-state';

const eligibleVehicleSelect = {
  id: true,
  brand: true,
  model: true,
  nickname: true,
  plate: true,
  mileageUpdatedAt: true,
  owner: {
    select: {
      id: true,
      notificationDevices: {
        select: { id: true, installationId: true, token: true },
      },
    },
  },
} satisfies Prisma.VehicleSelect;

const reminderClaimSelect = {
  id: true,
  vehicleId: true,
  installationId: true,
  notificationDeviceId: true,
  periodKey: true,
} satisfies Prisma.MileageReminderDeliverySelect;

const currentVehicleSelect = {
  id: true,
  ownerId: true,
  mileageUpdatedAt: true,
  owner: { select: { notificationsEnabled: true } },
} satisfies Prisma.VehicleSelect;

export type EligibleMileageReminderVehicle = Prisma.VehicleGetPayload<{
  select: typeof eligibleVehicleSelect;
}>;

export type MileageReminderCandidate = {
  vehicleId: string;
  ownerId: string;
  mileageUpdatedAt: Date;
  installationId: string;
  notificationDeviceId: string;
  token: string;
  periodKey: string;
};

export type MileageReminderClaim = Prisma.MileageReminderDeliveryGetPayload<{
  select: typeof reminderClaimSelect;
}>;

@Injectable()
export class MileageRemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findEligibleVehicles(cutoff: Date): Promise<EligibleMileageReminderVehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        mileageUpdatedAt: { lte: cutoff },
        owner: {
          notificationsEnabled: true,
          notificationDevices: { some: {} },
        },
      },
      select: eligibleVehicleSelect,
    });
  }

  claimDelivery(candidate: MileageReminderCandidate): Promise<MileageReminderClaim | null> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await this.lockAndReadCurrentContext(transaction, candidate);
      if (!current) return null;

      const uniqueKey = {
        vehicleId: candidate.vehicleId,
        installationId: candidate.installationId,
        periodKey: candidate.periodKey,
      };
      const existing = await transaction.mileageReminderDelivery.findUnique({
        where: { vehicleId_installationId_periodKey: uniqueKey },
        select: { ...reminderClaimSelect, status: true },
      });
      if (existing && existing.status !== MaintenanceAlertDeliveryStatus.FAILED) return null;

      if (existing) {
        const [reclaimed] = await transaction.mileageReminderDelivery.updateManyAndReturn({
          where: { id: existing.id, status: MaintenanceAlertDeliveryStatus.FAILED },
          data: {
            notificationDeviceId: candidate.notificationDeviceId,
            status: MaintenanceAlertDeliveryStatus.PENDING,
            fcmMessageId: null,
            errorCode: null,
            attemptedAt: new Date(),
            finishedAt: null,
          },
          select: reminderClaimSelect,
        });
        return reclaimed ?? null;
      }

      const [created] = await transaction.mileageReminderDelivery.createManyAndReturn({
        data: {
          ...uniqueKey,
          notificationDeviceId: candidate.notificationDeviceId,
        },
        skipDuplicates: true,
        select: reminderClaimSelect,
      });
      return created ?? null;
    });
  }

  withCurrentContextLock<T>(
    candidate: MileageReminderCandidate,
    action: () => Promise<T>,
  ): Promise<T | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const current = await this.lockAndReadCurrentContext(transaction, candidate);
        return current ? action() : null;
      },
      { timeout: 30_000 },
    );
  }

  async markSent(id: string, fcmMessageId: string): Promise<void> {
    await this.prisma.mileageReminderDelivery.update({
      where: { id },
      data: {
        status: MaintenanceAlertDeliveryStatus.SENT,
        fcmMessageId,
        finishedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, errorCode: string): Promise<void> {
    await this.prisma.mileageReminderDelivery.update({
      where: { id },
      data: {
        status: MaintenanceAlertDeliveryStatus.FAILED,
        errorCode,
        finishedAt: new Date(),
      },
    });
  }

  async removeDeviceIfTokenMatches(id: string, token: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await lockNotificationDeviceMutations(transaction);
      const device = await transaction.notificationDevice.findFirst({
        where: { id, token },
        select: { userId: true },
      });
      if (!device) return;

      await transaction.notificationDevice.deleteMany({ where: { id, token } });
      await disableNotificationsWithoutDevices(transaction, device.userId);
    });
  }

  private async lockAndReadCurrentContext(
    transaction: Prisma.TransactionClient,
    candidate: MileageReminderCandidate,
  ): Promise<boolean> {
    // Device mutations lock the device before updating its owner. Keep that order here, and hold a
    // shared owner lock so a notification opt-out cannot commit during the validated delivery.
    await transaction.$queryRaw`
      SELECT "id" FROM "NotificationDevice"
      WHERE "id" = ${candidate.notificationDeviceId}::uuid
      FOR UPDATE
    `;
    await transaction.$queryRaw`
      SELECT "id" FROM "User"
      WHERE "id" = ${candidate.ownerId}::uuid
      FOR SHARE
    `;
    await transaction.$queryRaw`
      SELECT "id" FROM "Vehicle"
      WHERE "id" = ${candidate.vehicleId}::uuid
      FOR UPDATE
    `;
    const device = await transaction.notificationDevice.findUnique({
      where: { id: candidate.notificationDeviceId },
      select: { userId: true, installationId: true, token: true },
    });
    const vehicle = await transaction.vehicle.findUnique({
      where: { id: candidate.vehicleId },
      select: currentVehicleSelect,
    });

    return Boolean(
      device &&
      vehicle &&
      vehicle.owner.notificationsEnabled &&
      vehicle.ownerId === candidate.ownerId &&
      vehicle.mileageUpdatedAt.getTime() === candidate.mileageUpdatedAt.getTime() &&
      device.userId === candidate.ownerId &&
      device.installationId === candidate.installationId &&
      device.token === candidate.token,
    );
  }
}
