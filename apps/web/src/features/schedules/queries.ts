import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSchedule, getSchedules } from './api';
import type { ScheduleInput } from './types';

export const schedulesQueryKey = (vehicleId: string) =>
  ['vehicles', vehicleId, 'schedules'] as const;

export const schedulesQueryOptions = (vehicleId: string) =>
  queryOptions({
    queryKey: schedulesQueryKey(vehicleId),
    queryFn: ({ signal }) => getSchedules(vehicleId, signal),
  });

export function useSchedules(vehicleId?: string) {
  return useQuery({ ...schedulesQueryOptions(vehicleId ?? ''), enabled: Boolean(vehicleId) });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, input }: { vehicleId: string; input: ScheduleInput }) =>
      createSchedule(vehicleId, input),
    onSuccess: async (_schedule, { vehicleId }) => {
      await queryClient.invalidateQueries({ queryKey: schedulesQueryKey(vehicleId) });
    },
  });
}
