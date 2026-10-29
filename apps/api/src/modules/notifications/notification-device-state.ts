import type { Prisma } from '../../generated/prisma/client';

const NOTIFICATION_DEVICE_MUTATION_LOCK = 'pitstop:notification-device-registration';

type NotificationDeviceStateTransaction = Pick<Prisma.TransactionClient, '$queryRaw' | 'user'>;

export async function lockNotificationDeviceMutations(
  transaction: Pick<NotificationDeviceStateTransaction, '$queryRaw'>,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${NOTIFICATION_DEVICE_MUTATION_LOCK}, 0)
    )::text AS "lockAcquired"
  `;
}

export async function disableNotificationsWithoutDevices(
  transaction: Pick<NotificationDeviceStateTransaction, 'user'>,
  userId: string,
): Promise<void> {
  await transaction.user.updateMany({
    where: { id: userId, notificationDevices: { none: {} } },
    data: { notificationsEnabled: false },
  });
}
