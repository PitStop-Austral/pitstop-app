import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currentUserQueryKey, useCurrentUser } from '@/features/users/queries';
import { createVehicle, deleteVehicle, getVehicles, setActiveVehicle, updateVehicle } from './api';
import type { VehicleUpdateInput } from './types';

export const vehiclesQueryKey = ['vehicles'] as const;

export const vehiclesQueryOptions = queryOptions({
  queryKey: vehiclesQueryKey,
  queryFn: ({ signal }) => getVehicles(signal),
});

export function useVehicles() {
  return useQuery(vehiclesQueryOptions);
}

export function useActiveVehicle() {
  const vehiclesQuery = useVehicles();
  const currentUserQuery = useCurrentUser();
  const vehicles = vehiclesQuery.data;
  const activeVehicle =
    vehicles?.find((vehicle) => vehicle.id === currentUserQuery.data?.activeVehicleId) ??
    vehicles?.[0];

  return { activeVehicle, currentUserQuery, vehiclesQuery };
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

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteVehicle,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: vehiclesQueryKey }),
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
    },
  });
}

export function useSetActiveVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setActiveVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });
}
