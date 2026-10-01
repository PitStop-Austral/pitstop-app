import { apiClient } from '@/lib/api-client';
import type { RegisteredNotificationDevice, RegisterNotificationDeviceInput } from './types';

export async function registerNotificationDevice(
  input: RegisterNotificationDeviceInput,
): Promise<RegisteredNotificationDevice> {
  const response = await apiClient.post<RegisteredNotificationDevice>(
    '/me/notification-devices',
    input,
  );
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
