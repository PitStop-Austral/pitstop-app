import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import {
  addMonths,
  formatFullDate,
  formatMonthLabel,
  getMonthGrid,
  monthOf,
} from './calendar-events';
import type { CalendarEvent, CalendarEventState, OnSelectDate } from './types';

const WEEKDAYS = [
  ['L', 'Lunes'],
  ['M', 'Martes'],
  ['M', 'Miércoles'],
  ['J', 'Jueves'],
  ['V', 'Viernes'],
  ['S', 'Sábado'],
  ['D', 'Domingo'],
] as const;

const STATES: Record<
  CalendarEventState,
  { dot: string; legend: string; one: string; many: string }
> = {
  completed: { dot: 'bg-success', legend: 'Completado', one: 'completado', many: 'completados' },
  overdue: { dot: 'bg-primary', legend: 'Vencido', one: 'vencido', many: 'vencidos' },
  scheduled: { dot: 'bg-warning', legend: 'A realizar', one: 'a realizar', many: 'a realizar' },
};

const STATE_KEYS = ['completed', 'overdue', 'scheduled'] as const;

const MAX_DOTS = 3;
const MAX_NAMES = 2;

function summarize(events: CalendarEvent[]): string {
  // Ordered like the events themselves: overdue, scheduled, completed.
  return (['overdue', 'scheduled', 'completed'] as const)
    .map((state) => {
      const count = events.filter((event) => event.state === state).length;
      if (count === 0) return null;
      return `${count} ${count === 1 ? STATES[state].one : STATES[state].many}`;
    })
    .filter(Boolean)
    .join(', ');
}

type MonthlyCalendarProps = {
  eventsByDate: Map<string, CalendarEvent[]>;
  today: string;
  selectedDate?: string;
  onSelectDate: OnSelectDate;
};

export function MonthlyCalendar({
  eventsByDate,
  today,
  selectedDate,
  onSelectDate,
}: MonthlyCalendarProps) {
  const [month, setMonth] = useState(() => monthOf(today));
  const monthPrefix = `${month.year}-${String(month.month).padStart(2, '0')}-`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-6">
        <Button
          aria-label="Mes anterior"
          size="icon"
          variant="icon"
          onClick={() => setMonth((current) => addMonths(current, -1))}
        >
          <Icon color="muted" name="ChevronLeft" size="md" />
        </Button>
        <Text aria-live="polite" as="h2" variant="heading">
          {formatMonthLabel(month)}
        </Text>
        <Button
          aria-label="Mes siguiente"
          size="icon"
          variant="icon"
          onClick={() => setMonth((current) => addMonths(current, 1))}
        >
          <Icon color="muted" name="ChevronRight" size="md" />
        </Button>
      </div>

      <div className="grid grid-cols-7 border-y border-border bg-neutral-50 py-2.5">
        {WEEKDAYS.map(([short, long]) => (
          <div key={long} className="text-center">
            <Text aria-hidden className="lg:hidden" color="muted" variant="caption-strong">
              {short}
            </Text>
            <Text className="sr-only lg:not-sr-only" color="muted" variant="caption-strong">
              {long}
            </Text>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 p-2 lg:p-3">
        {getMonthGrid(month).map((date) => {
          const events = eventsByDate.get(date) ?? [];
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const isOutside = !date.startsWith(monthPrefix);
          const dayNumber = String(Number(date.slice(8)));

          const content = (
            <>
              <Text
                color={isToday ? 'inverse' : isOutside ? 'subtle' : 'default'}
                variant="caption-strong"
              >
                {dayNumber}
              </Text>

              {events.length > 0 ? (
                <>
                  <div className="flex gap-1 lg:hidden">
                    {events.slice(0, MAX_DOTS).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          'size-1.5 rounded-full',
                          STATES[event.state].dot,
                          isToday && 'ring-1 ring-white',
                        )}
                      />
                    ))}
                  </div>
                  <div className="hidden w-full min-w-0 flex-col gap-0.5 lg:flex">
                    {events.slice(0, MAX_NAMES).map((event) => (
                      <div key={event.id} className="flex min-w-0 items-center gap-1.5">
                        <div
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            STATES[event.state].dot,
                            isToday && 'ring-1 ring-white',
                          )}
                        />
                        <Text
                          className="truncate"
                          color={isToday ? 'inverse' : 'muted'}
                          variant="caption"
                        >
                          {event.label}
                        </Text>
                      </div>
                    ))}
                    {events.length > MAX_NAMES ? (
                      <Text color={isToday ? 'inverse' : 'muted'} variant="caption">
                        {`+${events.length - MAX_NAMES} más`}
                      </Text>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          );

          const cellClassName = cn(
            'flex min-h-12 flex-col items-center gap-1 rounded-md p-1.5 lg:min-h-24 lg:items-start lg:p-2',
            isToday && 'bg-foreground',
            // Outline marks the selection so it never collides with the focus ring.
            isSelected && 'outline-2 -outline-offset-2 outline-primary',
            isSelected && !isToday && 'bg-red-50',
          );

          if (events.length === 0) {
            return (
              <div key={date} className={cellClassName}>
                {content}
              </div>
            );
          }

          return (
            <button
              key={date}
              aria-label={`${formatFullDate(date)}: ${summarize(events)}`}
              aria-pressed={isSelected}
              className={cn(
                cellClassName,
                'cursor-pointer text-left focus-visible:ring-[3px] focus-visible:ring-ring/50',
                // Drop the browser outline only when it isn't the selection marker.
                !isSelected && 'focus-visible:outline-none',
                !isToday && !isSelected && 'hover:bg-neutral-100',
              )}
              type="button"
              onClick={() => onSelectDate(date, events)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-4 py-3 lg:px-6">
        {STATE_KEYS.map((state) => (
          <div key={state} className="flex items-center gap-1.5">
            <div className={cn('size-2 rounded-full', STATES[state].dot)} />
            <Text color="muted" variant="caption">
              {STATES[state].legend}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
