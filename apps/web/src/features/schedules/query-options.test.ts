import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { scheduleDetailQueryOptions, schedulesQueryKey } from './query-options.ts';
import type { Schedule } from './types.ts';

const cachedSchedule: Schedule = {
  id: 'schedule-id',
  vehicleId: 'vehicle-id',
  type: 'Filtros',
  intervalMonths: 6,
  intervalKm: 10000,
  baselineDate: '2026-09-17',
  baselineMileage: 48000,
  nextDueDate: '2027-03-17',
  nextDueMileage: 58000,
  remainingDays: 181,
  remainingKm: 10000,
  status: 'on_track',
  dueReason: null,
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
};

test(
  'renders cached schedule data immediately and revalidates it on mount',
  { timeout: 1000 },
  async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000 } },
    });
    queryClient.setQueryData(schedulesQueryKey(cachedSchedule.vehicleId), [cachedSchedule]);
    const freshSchedule = { ...cachedSchedule, type: 'Cambio de aceite' };
    let requestCount = 0;
    const observer = new QueryObserver(
      queryClient,
      scheduleDetailQueryOptions(
        queryClient,
        cachedSchedule.vehicleId,
        cachedSchedule.id,
        async () => {
          requestCount++;
          return freshSchedule;
        },
      ),
    );

    assert.equal(observer.getCurrentResult().data?.type, cachedSchedule.type);

    let unsubscribe = () => {};
    try {
      const revalidated = new Promise<Schedule>((resolve) => {
        unsubscribe = observer.subscribe((result) => {
          if (result.data?.type === freshSchedule.type) resolve(result.data);
        });
      });

      assert.equal((await revalidated).type, freshSchedule.type);
      assert.equal(requestCount, 1);
    } finally {
      unsubscribe();
      queryClient.clear();
    }
  },
);
