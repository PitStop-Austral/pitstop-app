import { apiClient } from '@/lib/api-client';
import type { Maintenance, MaintenanceInput } from './types';

export async function createMaintenance(
  vehicleId: string,
  input: MaintenanceInput,
): Promise<Maintenance> {
  const response = await apiClient.post<Maintenance>(`/vehicles/${vehicleId}/maintenances`, input);
  return response.data;
}
