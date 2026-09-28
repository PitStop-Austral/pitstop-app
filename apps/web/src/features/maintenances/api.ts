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

export async function getMaintenance(
  vehicleId: string,
  id: string,
  signal?: AbortSignal,
): Promise<Maintenance> {
  const response = await apiClient.get<Maintenance>(`/vehicles/${vehicleId}/maintenances/${id}`, {
    signal,
  });
  return response.data;
}

export async function updateMaintenance(
  vehicleId: string,
  id: string,
  input: Partial<MaintenanceInput>,
): Promise<Maintenance> {
  const response = await apiClient.patch<Maintenance>(
    `/vehicles/${vehicleId}/maintenances/${id}`,
    input,
  );
  return response.data;
}

export async function deleteMaintenance(vehicleId: string, id: string): Promise<void> {
  await apiClient.delete(`/vehicles/${vehicleId}/maintenances/${id}`);
}
