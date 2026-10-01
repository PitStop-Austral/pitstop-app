import type { SignOutReason } from '@/lib/sign-out';
import type { ApiError } from '@/lib/api-client';
import { removeNotificationDevice } from './api';
import { getStoredInstallationId } from './installation-id';
import { shouldBlockManualLogout } from './logout-policy';
import { deleteNotificationToken } from './messaging';

function isUnauthorized(error: unknown): boolean {
  return (error as Partial<ApiError> | null)?.status === 401;
}

export async function prepareNotificationLogout(reason: SignOutReason): Promise<void> {
  const installationId = getStoredInstallationId(window.localStorage);
  if (!installationId) return;

  try {
    await removeNotificationDevice(installationId);
  } catch (error) {
    if (reason !== 'unauthorized' && !isUnauthorized(error) && shouldBlockManualLogout(error)) {
      throw error;
    }
  }

  try {
    await deleteNotificationToken();
  } catch {
    // The backend association is already gone (or the session expired), so local sign-out can finish.
  }
}
