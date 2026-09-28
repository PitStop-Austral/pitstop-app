import type { ScheduleView } from './schedules.repository';

export type ScheduleResponse = Omit<ScheduleView, 'baselineDate'> & { baselineDate: string };

export function toScheduleResponse(schedule: ScheduleView): ScheduleResponse {
  return { ...schedule, baselineDate: schedule.baselineDate.toISOString().slice(0, 10) };
}
