import { addCalendarMonths, computeScheduleDue } from './schedule-due';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('addCalendarMonths', () => {
  it('clamps to the end of shorter months, including leap years', () => {
    expect(addCalendarMonths(day('2026-01-31'), 1)).toEqual(day('2026-02-28'));
    expect(addCalendarMonths(day('2028-01-31'), 1)).toEqual(day('2028-02-29'));
    expect(addCalendarMonths(day('2026-08-31'), 6)).toEqual(day('2027-02-28'));
    expect(addCalendarMonths(day('2026-03-17'), 12)).toEqual(day('2027-03-17'));
    // MAX_SCHEDULE_INTERVAL_MONTHS: 20 years, still a valid, serializable date.
    expect(addCalendarMonths(day('2026-03-17'), 240)).toEqual(day('2046-03-17'));
    expect(addCalendarMonths(day('2028-02-29'), 240).toISOString()).toBe(
      '2048-02-29T00:00:00.000Z',
    );
  });
});

describe('computeScheduleDue', () => {
  const context = {
    currentMileage: 50000,
    today: day('2026-09-17'),
    thresholdDays: 30,
    thresholdKm: 1500,
  };
  const base = { baselineDate: day('2026-03-17'), baselineMileage: 40000 };

  it('uses only months when km is missing', () => {
    expect(computeScheduleDue({ ...base, intervalMonths: 12, intervalKm: null }, context)).toEqual({
      nextDueDate: day('2027-03-17'),
      nextDueMileage: null,
      remainingDays: 181,
      remainingKm: null,
      status: 'on_track',
      dueReason: null,
    });
  });

  it('uses only km when months is missing', () => {
    expect(
      computeScheduleDue({ ...base, intervalMonths: null, intervalKm: 20000 }, context),
    ).toEqual({
      nextDueDate: null,
      nextDueMileage: 60000,
      remainingDays: null,
      remainingKm: 10000,
      status: 'on_track',
      dueReason: null,
    });
  });

  it('is overdue as soon as either criterion is reached, even if the other is far', () => {
    const byKm = computeScheduleDue({ ...base, intervalMonths: 24, intervalKm: 10000 }, context);
    expect(byKm).toMatchObject({ remainingKm: 0, status: 'overdue' });
    expect(byKm.remainingDays).toBeGreaterThan(500);

    const byDate = computeScheduleDue({ ...base, intervalMonths: 6, intervalKm: 100000 }, context);
    expect(byDate).toMatchObject({ remainingDays: 0, remainingKm: 90000, status: 'overdue' });
  });

  it('goes negative past the due point', () => {
    expect(
      computeScheduleDue({ ...base, intervalMonths: 5, intervalKm: 8000 }, context),
    ).toMatchObject({ remainingDays: -31, remainingKm: -2000, status: 'overdue' });
  });

  it('treats the day and km before the due point as not overdue', () => {
    const today = day('2026-09-16');
    expect(
      computeScheduleDue({ ...base, intervalMonths: 6, intervalKm: null }, { ...context, today }),
    ).toMatchObject({ remainingDays: 1, status: 'upcoming' });
    expect(
      computeScheduleDue({ ...base, intervalMonths: null, intervalKm: 10001 }, context),
    ).toMatchObject({ remainingKm: 1, status: 'upcoming' });
  });

  it('applies the upcoming thresholds inclusively', () => {
    // 2026-10-17 is exactly 30 days after 2026-09-17.
    const at = { ...base, baselineDate: day('2026-04-17'), intervalKm: null, intervalMonths: 6 };
    expect(computeScheduleDue(at, context)).toMatchObject({
      remainingDays: 30,
      status: 'upcoming',
    });
    const past = { ...at, baselineDate: day('2026-04-18') };
    expect(computeScheduleDue(past, context)).toMatchObject({
      remainingDays: 31,
      status: 'on_track',
    });

    const km = { ...base, intervalMonths: null };
    expect(computeScheduleDue({ ...km, intervalKm: 11500 }, context)).toMatchObject({
      remainingKm: 1500,
      status: 'upcoming',
    });
    expect(computeScheduleDue({ ...km, intervalKm: 11501 }, context)).toMatchObject({
      remainingKm: 1501,
      status: 'on_track',
    });
  });

  it('is upcoming when either criterion enters its threshold', () => {
    expect(
      computeScheduleDue({ ...base, intervalMonths: 24, intervalKm: 11000 }, context),
    ).toMatchObject({ remainingKm: 1000, status: 'upcoming' });
  });

  it('respects custom user thresholds', () => {
    const schedule = { ...base, intervalMonths: null, intervalKm: 11000 };
    expect(computeScheduleDue(schedule, { ...context, thresholdKm: 500 }).status).toBe('on_track');
  });

  it('handles a vehicle mileage below the baseline without breaking', () => {
    expect(
      computeScheduleDue(
        { ...base, intervalMonths: null, intervalKm: 10000 },
        { ...context, currentMileage: 39000 },
      ),
    ).toMatchObject({ remainingKm: 11000, status: 'on_track' });
  });

  it('computes a fresh schedule from a fallback baseline (no prior service)', () => {
    // PIT-52 falls back to today + current mileage when no maintenance exists.
    expect(
      computeScheduleDue(
        {
          intervalMonths: 6,
          intervalKm: 10000,
          baselineDate: context.today,
          baselineMileage: 50000,
        },
        context,
      ),
    ).toMatchObject({ remainingDays: 181, remainingKm: 10000, status: 'on_track' });
  });

  describe('dueReason', () => {
    const both = { ...base, intervalMonths: 6, intervalKm: 10000 };
    const reason = (schedule: Parameters<typeof computeScheduleDue>[0], currentMileage: number) =>
      computeScheduleDue(schedule, { ...context, currentMileage });

    it('is null when on track', () => {
      expect(reason({ ...both, intervalMonths: 12, intervalKm: 20000 }, 50000)).toMatchObject({
        status: 'on_track',
        dueReason: null,
      });
    });

    it('names the criterion that reached its limit when overdue', () => {
      // Date due today; km: 50000 → 1 km left (still upcoming-range, but overdue only reports limits).
      expect(reason({ ...both, intervalKm: 10001 }, 50000)).toMatchObject({
        status: 'overdue',
        dueReason: 'date',
      });
      expect(reason({ ...both, intervalMonths: 24 }, 50000)).toMatchObject({
        status: 'overdue',
        dueReason: 'mileage',
      });
      expect(reason(both, 50000)).toMatchObject({ status: 'overdue', dueReason: 'both' });
    });

    it('names the criterion within its threshold when upcoming', () => {
      const today = day('2026-09-10'); // 7 days before the 2026-09-17 due date
      expect(
        computeScheduleDue({ ...both, intervalKm: 20000 }, { ...context, today }),
      ).toMatchObject({ status: 'upcoming', dueReason: 'date' });
      expect(reason({ ...both, intervalMonths: 24, intervalKm: 11000 }, 50000)).toMatchObject({
        status: 'upcoming',
        dueReason: 'mileage',
      });
      expect(
        computeScheduleDue({ ...both, intervalKm: 11000 }, { ...context, today }),
      ).toMatchObject({ status: 'upcoming', dueReason: 'both' });
    });

    it('is date or mileage (never both) when only one interval exists', () => {
      expect(reason({ ...base, intervalMonths: 6, intervalKm: null }, 50000).dueReason).toBe(
        'date',
      );
      expect(reason({ ...base, intervalMonths: null, intervalKm: 10000 }, 50000).dueReason).toBe(
        'mileage',
      );
    });
  });

  it('returns remainingDays as a whole number of days', () => {
    for (let months = 1; months <= 24; months += 1) {
      const { remainingDays } = computeScheduleDue(
        { ...base, intervalMonths: months, intervalKm: null },
        context,
      );
      expect(Number.isInteger(remainingDays)).toBe(true);
    }
  });
});
