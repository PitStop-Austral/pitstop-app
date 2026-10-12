import { formatDate, formatNumber } from '@/lib/format';
import { normalizeServiceType } from './service-catalog';
import type { Schedule } from '../schedules/types';

type ScheduleDue = Pick<Schedule, 'type' | 'nextDueDate' | 'nextDueMileage'>;

export function getNextMaintenanceDue(
  type: string,
  schedules: readonly ScheduleDue[] | undefined,
): string | null {
  const schedule = schedules?.find(
    (candidate) => normalizeServiceType(candidate.type) === normalizeServiceType(type),
  );
  if (!schedule) return null;

  const due = [
    schedule.nextDueDate ? formatDate(schedule.nextDueDate) : null,
    schedule.nextDueMileage === null ? null : `${formatNumber(schedule.nextDueMileage)} km`,
  ].filter((value): value is string => value !== null);

  return due.length > 0 ? due.join(' · ') : null;
}
