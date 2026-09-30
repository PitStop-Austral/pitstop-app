export type ScheduleStatus = 'overdue' | 'upcoming' | 'on_track';
export type ScheduleDueReason = 'date' | 'mileage' | 'both';

export type Schedule = {
  id: string;
  vehicleId: string;
  type: string;
  intervalMonths: number | null;
  intervalKm: number | null;
  baselineDate: string;
  baselineMileage: number;
  nextDueDate: string | null;
  nextDueMileage: number | null;
  remainingDays: number | null;
  remainingKm: number | null;
  status: ScheduleStatus;
  dueReason: ScheduleDueReason | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleInput = Pick<Schedule, 'type' | 'intervalMonths' | 'intervalKm'>;
