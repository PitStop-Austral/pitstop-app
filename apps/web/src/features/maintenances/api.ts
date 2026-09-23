import { apiClient } from '@/lib/api-client';
import type { Maintenance, MaintenanceInput } from './types';

export async function getMaintenances(
  vehicleId: string,
  signal?: AbortSignal,
): Promise<Maintenance[]> {
  const response = await apiClient.get<Maintenance[]>(`/vehicles/${vehicleId}/maintenances`, {
    signal,
  });
  return response.data;
}

export async function createMaintenance(
  vehicleId: string,
  input: MaintenanceInput,
): Promise<Maintenance> {
  const response = await apiClient.post<Maintenance>(`/vehicles/${vehicleId}/maintenances`, input);
  return response.data;
}
