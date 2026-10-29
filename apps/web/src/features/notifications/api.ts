import { apiClient } from '@/lib/api-client';
import type {
  NotificationPreferences,
  RegisteredNotificationDevice,
  RegisterNotificationDeviceInput,
} from './types';

export async function registerNotificationDevice(
  input: RegisterNotificationDeviceInput,
): Promise<RegisteredNotificationDevice> {
  const response = await apiClient.post<RegisteredNotificationDevice>(
    '/me/notification-devices',
    input,
  );
  return response.data;
}

export async function updateNotificationPreferences(
  enabled: boolean,
): Promise<NotificationPreferences> {
  const response = await apiClient.patch<NotificationPreferences>('/me/notification-preferences', {
    enabled,
  });
  return response.data;
}

export async function removeNotificationDevice(installationId: string): Promise<void> {
  await apiClient.delete(`/me/notification-devices/${encodeURIComponent(installationId)}`, {
    skipUnauthorizedHandler: true,
  });
}

export async function markNotificationPromptShown(): Promise<void> {
  await apiClient.patch('/me/notification-prompt');
}
