import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  disableNotificationsWithoutDevices,
  lockNotificationDeviceMutations,
} from './notification-device-state';

export type RegisteredNotificationDevice = {
  id: string;
  installationId: string;
};

export type NotificationPreferences = {
  notificationsEnabled: boolean;
};

export type NotificationDeliveryDevice = {
  id: string;
  token: string;
  user: { notificationsEnabled: boolean };
};

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    userId: string,
    installationId: string,
    token: string,
  ): Promise<RegisteredNotificationDevice> {
    return this.prisma.$transaction(async (transaction) => {
      // Registration is rare, and a transaction-scoped lock makes token transfers deterministic
      // even when two installations claim the same new token concurrently.
      await lockNotificationDeviceMutations(transaction);

      await transaction.notificationDevice.deleteMany({
        where: { token, installationId: { not: installationId } },
      });

      const device = await transaction.notificationDevice.upsert({
        where: { installationId },
        create: { userId, installationId, token },
        update: { userId, token },
        select: { id: true, installationId: true },
      });

      await transaction.user.update({
        where: { id: userId },
        data: { notificationsEnabled: true },
      });

      return device;
    });
  }

  async updatePreferences(
    userId: string,
    enabled: boolean,
  ): Promise<NotificationPreferences | null> {
    const result = await this.prisma.user.updateMany({
      where: enabled ? { id: userId, notificationDevices: { some: {} } } : { id: userId },
      data: { notificationsEnabled: enabled },
    });

    return result.count === 0 ? null : { notificationsEnabled: enabled };
  }

  async remove(userId: string, installationId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await lockNotificationDeviceMutations(transaction);
      await transaction.notificationDevice.deleteMany({ where: { userId, installationId } });
      await disableNotificationsWithoutDevices(transaction, userId);
    });
  }

  findOwnedForDelivery(
    userId: string,
    installationId: string,
  ): Promise<NotificationDeliveryDevice | null> {
    return this.prisma.notificationDevice.findFirst({
      where: { userId, installationId },
      select: {
        id: true,
        token: true,
        user: { select: { notificationsEnabled: true } },
      },
    });
  }

  async removeIfTokenMatches(id: string, token: string): Promise<void> {
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

  async markPromptShown(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, notificationPromptShownAt: null },
      data: { notificationPromptShownAt: new Date() },
    });
  }
}
