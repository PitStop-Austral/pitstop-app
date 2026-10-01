import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSchedule, deleteSchedule, getSchedule, getSchedules, updateSchedule } from './api';
import { scheduleDetailQueryOptions, scheduleQueryKey, schedulesQueryKey } from './query-options';
import type { Schedule, ScheduleInput } from './types';

export { scheduleQueryKey, schedulesQueryKey } from './query-options';

export const schedulesQueryOptions = (vehicleId: string) =>
  queryOptions({
    queryKey: schedulesQueryKey(vehicleId),
    queryFn: ({ signal }) => getSchedules(vehicleId, signal),
  });

export function useSchedules(vehicleId?: string) {
  return useQuery({ ...schedulesQueryOptions(vehicleId ?? ''), enabled: Boolean(vehicleId) });
}

export function useSchedule(vehicleId: string, id: string) {
  const queryClient = useQueryClient();

  return useQuery(
    scheduleDetailQueryOptions(queryClient, vehicleId, id, (signal) =>
      getSchedule(vehicleId, id, signal),
    ),
  );
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, input }: { vehicleId: string; input: ScheduleInput }) =>
      createSchedule(vehicleId, input),
    onSuccess: async (_schedule, { vehicleId }) => {
      await queryClient.invalidateQueries({ queryKey: schedulesQueryKey(vehicleId), exact: true });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vehicleId,
      id,
      input,
    }: {
      vehicleId: string;
      id: string;
      input: Partial<ScheduleInput>;
    }) => updateSchedule(vehicleId, id, input),
    onSuccess: async (updated, { vehicleId, id }) => {
      queryClient.setQueryData(scheduleQueryKey(vehicleId, id), updated);
      queryClient.setQueryData<Schedule[]>(schedulesQueryKey(vehicleId), (current) =>
        current?.map((schedule) => (schedule.id === id ? updated : schedule)),
      );
      await queryClient.invalidateQueries({ queryKey: schedulesQueryKey(vehicleId), exact: true });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, id }: { vehicleId: string; id: string }) =>
      deleteSchedule(vehicleId, id),
    onSuccess: async (_data, { vehicleId, id }) => {
      queryClient.removeQueries({ queryKey: scheduleQueryKey(vehicleId, id) });
      queryClient.setQueryData<Schedule[]>(schedulesQueryKey(vehicleId), (current) =>
        current?.filter((schedule) => schedule.id !== id),
      );
      await queryClient.invalidateQueries({ queryKey: schedulesQueryKey(vehicleId), exact: true });
    },
  });
}
