import { apiClient } from '@/lib/api-client';
import type { Schedule, ScheduleInput } from './types';

export async function getSchedules(vehicleId: string, signal?: AbortSignal): Promise<Schedule[]> {
  const response = await apiClient.get<Schedule[]>(`/vehicles/${vehicleId}/schedules`, { signal });
  return response.data;
}

export async function createSchedule(vehicleId: string, input: ScheduleInput): Promise<Schedule> {
  const response = await apiClient.post<Schedule>(`/vehicles/${vehicleId}/schedules`, input);
  return response.data;
}
