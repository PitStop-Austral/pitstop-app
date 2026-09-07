import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currentUserQueryKey } from '@/features/users/queries';
import { createVehicle, getVehicles, updateVehicle } from './api';
import type { VehicleUpdateInput } from './types';

export const vehiclesQueryKey = ['vehicles'] as const;

export const vehiclesQueryOptions = queryOptions({
  queryKey: vehiclesQueryKey,
  queryFn: ({ signal }) => getVehicles(signal),
});

export function useVehicles() {
  return useQuery(vehiclesQueryOptions);
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVehicle,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: vehiclesQueryKey }),
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VehicleUpdateInput }) =>
      updateVehicle(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKey });
    },
  });
}
