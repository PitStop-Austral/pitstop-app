import type { Schedule, ScheduleStatus } from './types.ts';

const STATUS_ORDER: Record<ScheduleStatus, number> = { overdue: 0, upcoming: 1, on_track: 2 };

// Missing criteria sort last so a schedule without that interval never looks more urgent.
function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

// Only orders what the API already computed; due state is never recalculated here.
export function sortSchedules(schedules: Schedule[]): Schedule[] {
  return [...schedules].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      compareNullableAsc(a.remainingDays, b.remainingDays) ||
      compareNullableAsc(a.remainingKm, b.remainingKm) ||
      a.type.localeCompare(b.type, 'es'),
  );
}
