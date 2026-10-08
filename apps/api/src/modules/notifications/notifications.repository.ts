import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const NOTIFICATION_DEVICE_REGISTRATION_LOCK = 'pitstop:notification-device-registration';

export type RegisteredNotificationDevice = {
  id: string;
  installationId: string;
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
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${NOTIFICATION_DEVICE_REGISTRATION_LOCK}, 0)
        )::text AS "lockAcquired"
      `;

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

  async remove(userId: string, installationId: string): Promise<void> {
    await this.prisma.notificationDevice.deleteMany({ where: { userId, installationId } });
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
    await this.prisma.notificationDevice.deleteMany({ where: { id, token } });
  }

  async markPromptShown(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, notificationPromptShownAt: null },
      data: { notificationPromptShownAt: new Date() },
    });
  }
}
