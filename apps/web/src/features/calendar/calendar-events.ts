import type { Maintenance } from '@/features/maintenances/types';
import type { Schedule } from '@/features/schedules/types';
import type { CalendarEvent, CalendarEventState } from './types';

// Every date here is a civil `YYYY-MM-DD` string. Dates are only ever built with Date.UTC and
// read with getUTC*/timeZone 'UTC', so the browser's timezone can never shift a day.

export type CalendarMonth = { year: number; month: number }; // month is 1-12

const STATE_ORDER: Record<CalendarEventState, number> = { overdue: 0, scheduled: 1, completed: 2 };

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  return (
    STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
    a.label.localeCompare(b.label, 'es') ||
    a.id.localeCompare(b.id)
  );
}

// Schedules without a due date (km-only) are left out: they have no real day to sit on.
export function toCalendarEvents(
  maintenances: Maintenance[],
  schedules: Schedule[],
): Map<string, CalendarEvent[]> {
  const events: CalendarEvent[] = [
    ...maintenances.map((maintenance): CalendarEvent => ({
      source: 'maintenance',
      id: `maintenance:${maintenance.id}`,
      date: maintenance.date,
      label: maintenance.type,
      state: 'completed',
      maintenance,
    })),
    ...schedules.flatMap((schedule): CalendarEvent[] =>
      schedule.nextDueDate == null
        ? []
        : [
            {
              source: 'schedule',
              id: `schedule:${schedule.id}`,
              date: schedule.nextDueDate,
              label: schedule.type,
              state: schedule.status === 'overdue' ? 'overdue' : 'scheduled',
              schedule,
            },
          ],
    ),
  ];

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = byDate.get(event.date);
    if (day) day.push(event);
    else byDate.set(event.date, [event]);
  }
  for (const day of byDate.values()) day.sort(compareEvents);
  return byDate;
}

function toUtcDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const toDateValue = (date: Date) => date.toISOString().slice(0, 10);

export function monthOf(date: string): CalendarMonth {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

export function addMonths({ year, month }: CalendarMonth, months: number): CalendarMonth {
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

// 6 weeks × 7 days, Monday first, padded with the adjacent months' days.
export function getMonthGrid({ year, month }: CalendarMonth): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) =>
    toDateValue(new Date(Date.UTC(year, month - 1, 1 - mondayOffset + index))),
  );
}

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase('es-AR') + value.slice(1);

export function formatMonthLabel({ year, month }: CalendarMonth): string {
  return capitalize(
    new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    ),
  );
}

export function formatFullDate(date: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(toUtcDate(date));
}
