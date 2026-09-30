// Every date here (`today`, `baselineDate`, `nextDueDate`) is UTC midnight of a calendar day,
// with no time part: `baselineDate` is a `@db.Date` column and `today` comes from
// `argentinaDateToday()`. Because of that, the difference between two of them is always a
// whole number of days (UTC has no DST), so `remainingDays` is an exact integer.

const DAY_MS = 86_400_000;

export type ScheduleStatus = 'overdue' | 'upcoming' | 'on_track';
export type ScheduleDueReason = 'date' | 'mileage' | 'both';

export type ScheduleDue = {
  nextDueDate: Date | null;
  nextDueMileage: number | null;
  remainingDays: number | null;
  remainingKm: number | null;
  status: ScheduleStatus;
  /** Which criterion put the schedule in its status; null when on track. */
  dueReason: ScheduleDueReason | null;
};

type ScheduleBase = {
  intervalMonths: number | null;
  intervalKm: number | null;
  baselineDate: Date;
  baselineMileage: number;
};

type DueContext = {
  currentMileage: number;
  today: Date;
  thresholdDays: number;
  thresholdKm: number;
};

/** Adds calendar months, clamping to the last day of the target month (Jan 31 + 1 → Feb 28/29). */
export function addCalendarMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

export function computeScheduleDue(schedule: ScheduleBase, context: DueContext): ScheduleDue {
  const nextDueDate =
    schedule.intervalMonths == null
      ? null
      : addCalendarMonths(schedule.baselineDate, schedule.intervalMonths);
  const nextDueMileage =
    schedule.intervalKm == null ? null : schedule.baselineMileage + schedule.intervalKm;
  const remainingDays =
    nextDueDate == null ? null : (nextDueDate.getTime() - context.today.getTime()) / DAY_MS;
  const remainingKm = nextDueMileage == null ? null : nextDueMileage - context.currentMileage;

  // Limits are inclusive: reaching the due day or mileage already counts as overdue.
  const reasonWithin = (days: number, km: number): ScheduleDueReason | null => {
    const byDate = remainingDays != null && remainingDays <= days;
    const byMileage = remainingKm != null && remainingKm <= km;
    if (byDate && byMileage) return 'both';
    return byDate ? 'date' : byMileage ? 'mileage' : null;
  };

  const overdueReason = reasonWithin(0, 0);
  const upcomingReason = overdueReason
    ? null
    : reasonWithin(context.thresholdDays, context.thresholdKm);
  const status: ScheduleStatus = overdueReason
    ? 'overdue'
    : upcomingReason
      ? 'upcoming'
      : 'on_track';

  return {
    nextDueDate,
    nextDueMileage,
    remainingDays,
    remainingKm,
    status,
    dueReason: overdueReason ?? upcomingReason,
  };
}
