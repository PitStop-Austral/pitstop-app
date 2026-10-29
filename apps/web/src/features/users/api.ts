import { apiClient } from '@/lib/api-client';

export type CurrentUser = {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  activeVehicleId: string | null;
  upcomingThresholdDays: number;
  upcomingThresholdKm: number;
  notificationsEnabled: boolean;
  notificationPromptShownAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileSummary = {
  vehicleCount: number;
  serviceCount: number;
};

export type UpdateMeInput = {
  name: string;
};

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const response = await apiClient.get<CurrentUser>('/me', { signal });
  return response.data;
}

export async function getProfileSummary(signal?: AbortSignal): Promise<ProfileSummary> {
  const response = await apiClient.get<ProfileSummary>('/me/profile-summary', { signal });
  return response.data;
}

export async function updateMe(input: UpdateMeInput): Promise<CurrentUser> {
  const response = await apiClient.patch<CurrentUser>('/me', input);
  return response.data;
}
