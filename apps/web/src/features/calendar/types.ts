import type { Maintenance } from '@/features/maintenances/types';
import type { Schedule } from '@/features/schedules/types';

export type CalendarEvent =
  | {
      source: 'maintenance';
      id: string;
      date: string;
      label: string;
      state: 'completed';
      maintenance: Maintenance;
    }
  | {
      source: 'schedule';
      id: string;
      date: string;
      label: string;
      state: 'overdue' | 'scheduled';
      schedule: Schedule;
    };

export type CalendarEventState = CalendarEvent['state'];

export type OnSelectDate = (date: string, events: CalendarEvent[]) => void;
