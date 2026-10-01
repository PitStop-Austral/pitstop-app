import type { QueryClient, QueryFunctionContext } from '@tanstack/react-query';
import type { Schedule } from './types.ts';

export const schedulesQueryKey = (vehicleId: string) =>
  ['vehicles', vehicleId, 'schedules'] as const;

export const scheduleQueryKey = (vehicleId: string, id: string) =>
  [...schedulesQueryKey(vehicleId), id] as const;

type ScheduleDetailQueryKey = ReturnType<typeof scheduleQueryKey>;

export function scheduleDetailQueryOptions(
  queryClient: QueryClient,
  vehicleId: string,
  id: string,
  fetchSchedule: (signal: AbortSignal) => Promise<Schedule>,
) {
  return {
    queryKey: scheduleQueryKey(vehicleId, id),
    queryFn: ({ signal }: QueryFunctionContext<ScheduleDetailQueryKey>) => fetchSchedule(signal),
    initialData: () =>
      queryClient
        .getQueryData<Schedule[]>(schedulesQueryKey(vehicleId))
        ?.find((schedule) => schedule.id === id),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(schedulesQueryKey(vehicleId))?.dataUpdatedAt,
    refetchOnMount: 'always' as const,
  };
}
