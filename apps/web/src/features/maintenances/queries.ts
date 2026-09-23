import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vehiclesQueryKey } from '@/features/vehicles/queries';
import {
  createMaintenance,
  deleteMaintenance,
  getMaintenance,
  getMaintenances,
  updateMaintenance,
} from './api';
import type { Maintenance, MaintenanceInput } from './types';

export const maintenancesQueryKey = (vehicleId: string) =>
  ['vehicles', vehicleId, 'maintenances'] as const;

export const maintenanceQueryKey = (vehicleId: string, id: string) =>
  ['vehicles', vehicleId, 'maintenances', id] as const;

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

export function useMaintenance(vehicleId: string, id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: maintenanceQueryKey(vehicleId, id),
    queryFn: ({ signal }) => getMaintenance(vehicleId, id, signal),
    // The list already carries every field, so the detail opens instantly from it.
    initialData: () =>
      queryClient
        .getQueryData<Maintenance[]>(maintenancesQueryKey(vehicleId))
        ?.find((maintenance) => maintenance.id === id),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(maintenancesQueryKey(vehicleId))?.dataUpdatedAt,
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

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vehicleId,
      id,
      input,
    }: {
      vehicleId: string;
      id: string;
      input: Partial<MaintenanceInput>;
    }) => updateMaintenance(vehicleId, id, input),
    onSuccess: async (updated, { vehicleId, id }) => {
      // An inactive detail query ignores initialData, so without this a reopened detail would
      // flash the pre-edit values until its refetch lands.
      queryClient.setQueryData(maintenanceQueryKey(vehicleId, id), updated);
      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKey });
    },
  });
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, id }: { vehicleId: string; id: string }) =>
      deleteMaintenance(vehicleId, id),
    onSuccess: async (_data, { vehicleId, id }) => {
      // Dropped first so the invalidation below doesn't refetch a detail that now 404s.
      queryClient.removeQueries({ queryKey: maintenanceQueryKey(vehicleId, id) });
      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKey });
    },
  });
}
