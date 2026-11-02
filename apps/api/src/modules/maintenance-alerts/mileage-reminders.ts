export const MILEAGE_REMINDER_AFTER_DAYS = 30;
export const MILEAGE_REMINDER_REPEAT_DAYS = 30;

const DAY_IN_MILLISECONDS = 86_400_000;

export function mileageReminderPeriod(mileageUpdatedAt: Date, now: Date): number | null {
  const elapsedDays = Math.floor(
    (now.getTime() - mileageUpdatedAt.getTime()) / DAY_IN_MILLISECONDS,
  );
  if (elapsedDays < MILEAGE_REMINDER_AFTER_DAYS) return null;

  return 1 + Math.floor((elapsedDays - MILEAGE_REMINDER_AFTER_DAYS) / MILEAGE_REMINDER_REPEAT_DAYS);
}

export function mileageReminderPeriodKey(mileageUpdatedAt: Date, period: number): string {
  return `${mileageUpdatedAt.toISOString()}#${period}`;
}
