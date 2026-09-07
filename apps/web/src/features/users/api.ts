import { apiClient } from '@/lib/api-client';

export type CurrentUser = {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  activeVehicleId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const response = await apiClient.get<CurrentUser>('/me', { signal });
  return response.data;
}
