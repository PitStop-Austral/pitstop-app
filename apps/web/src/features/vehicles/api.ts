import { apiClient } from '@/lib/api-client';
import type { Vehicle, VehicleInput, VehicleUpdateInput } from './types';

export async function getVehicles(signal?: AbortSignal): Promise<Vehicle[]> {
  const response = await apiClient.get<Vehicle[]>('/vehicles', { signal });
  return response.data;
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const response = await apiClient.post<Vehicle>('/vehicles', input);
  return response.data;
}

export async function updateVehicle(id: string, input: VehicleUpdateInput): Promise<Vehicle> {
  const response = await apiClient.patch<Vehicle>(`/vehicles/${id}`, input);
  return response.data;
}

export async function deleteVehicle(id: string): Promise<void> {
  await apiClient.delete(`/vehicles/${id}`);
}
