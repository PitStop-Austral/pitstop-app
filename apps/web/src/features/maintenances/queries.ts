import { useMutation, useQueryClient } from '@tanstack/react-query';

import { vehiclesQueryKey } from '@/features/vehicles/queries';
import { createMaintenance } from './api';
import type { MaintenanceInput } from './types';

export const maintenancesQueryKey = (vehicleId: string) =>
  ['vehicles', vehicleId, 'maintenances'] as const;

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
