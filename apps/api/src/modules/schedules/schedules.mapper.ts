import type { ScheduleDue } from './schedule-due';
import type { ScheduleView } from './schedules.repository';

export type ScheduleResponse = Omit<ScheduleView, 'baselineDate'> &
  Omit<ScheduleDue, 'nextDueDate'> & { baselineDate: string; nextDueDate: string | null };

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export function toScheduleResponse(schedule: ScheduleView, due: ScheduleDue): ScheduleResponse {
  return {
    ...schedule,
    ...due,
    baselineDate: toDateOnly(schedule.baselineDate),
    nextDueDate: due.nextDueDate && toDateOnly(due.nextDueDate),
  };
}
