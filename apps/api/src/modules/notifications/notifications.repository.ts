import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const NOTIFICATION_DEVICE_REGISTRATION_LOCK = 'pitstop:notification-device-registration';

export type RegisteredNotificationDevice = {
  id: string;
  installationId: string;
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

  async markPromptShown(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, notificationPromptShownAt: null },
      data: { notificationPromptShownAt: new Date() },
    });
  }
}
