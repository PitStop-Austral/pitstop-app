import type { NotificationCapability } from './notification-support';

export type NotificationCapabilityState = NotificationCapability | 'checking';

export type NotificationToggleAction =
  | 'disable-account'
  | 'open-permission-sheet'
  | 'register-current-device'
  | 'unavailable';

export function resolveNotificationToggleAction({
  capability,
  hasInstallationId,
  nextChecked,
  permission,
}: {
  capability: NotificationCapabilityState;
  hasInstallationId: boolean;
  nextChecked: boolean;
  permission: NotificationPermission | null;
}): NotificationToggleAction {
  if (!nextChecked) return 'disable-account';
  if (capability !== 'supported') return 'unavailable';
  if (permission !== 'granted' || !hasInstallationId) return 'open-permission-sheet';
  return 'register-current-device';
}

export type OptimisticNotificationPreference<User> = {
  previousUser: User | undefined;
  optimisticUser: User | undefined;
};

export function beginOptimisticNotificationPreference<
  User extends { notificationsEnabled: boolean },
>(user: User | undefined, enabled: boolean): OptimisticNotificationPreference<User> {
  return {
    previousUser: user,
    optimisticUser: user ? { ...user, notificationsEnabled: enabled } : undefined,
  };
}

export function rollbackNotificationPreference<User>(
  update: OptimisticNotificationPreference<User>,
): User | undefined {
  return update.previousUser;
}
