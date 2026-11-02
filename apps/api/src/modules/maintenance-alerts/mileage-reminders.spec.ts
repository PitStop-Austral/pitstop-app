import { mileageReminderPeriod, mileageReminderPeriodKey } from './mileage-reminders';

describe('mileage reminders', () => {
  const mileageUpdatedAt = new Date('2026-01-01T12:00:00.000Z');

  it.each([
    [29, null],
    [30, 1],
    [59, 1],
    [60, 2],
    [90, 3],
  ])('returns period %s after %s elapsed days', (days, expected) => {
    const now = new Date(mileageUpdatedAt.getTime() + days * 86_400_000);

    expect(mileageReminderPeriod(mileageUpdatedAt, now)).toBe(expected);
  });

  it('changes the period key after the mileage is confirmed again', () => {
    expect(mileageReminderPeriodKey(mileageUpdatedAt, 1)).not.toBe(
      mileageReminderPeriodKey(new Date('2026-01-02T12:00:00.000Z'), 1),
    );
  });
});
