import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vehiclesQueryKey } from '@/features/vehicles/queries';
import { createMaintenance, getMaintenances } from './api';
import type { MaintenanceInput } from './types';

export const maintenancesQueryKey = (vehicleId: string) =>
  ['vehicles', vehicleId, 'maintenances'] as const;

export const maintenancesQueryOptions = (vehicleId: string) =>
  queryOptions({
    queryKey: maintenancesQueryKey(vehicleId),
    queryFn: ({ signal }) => getMaintenances(vehicleId, signal),
  });

export function useMaintenances(vehicleId?: string) {
  return useQuery({
    ...maintenancesQueryOptions(vehicleId ?? ''),
    enabled: Boolean(vehicleId),
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, input }: { vehicleId: string; input: MaintenanceInput }) =>
      createMaintenance(vehicleId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKey });
    },
  });
}
