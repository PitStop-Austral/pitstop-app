import { buildKpiWindows, dateKeyInArgentina } from './kpi-dates';

describe('KPI date windows', () => {
  it('builds the closed Argentine day and its inclusive 30-day window', () => {
    expect(buildKpiWindows('2026-10-21')).toEqual({
      date: new Date('2026-10-21T00:00:00.000Z'),
      windowStart: new Date('2026-10-21T03:00:00.000Z'),
      windowEnd: new Date('2026-10-22T03:00:00.000Z'),
      thirtyDayWindowStart: new Date('2026-09-22T03:00:00.000Z'),
    });
  });

  it('resolves the current calendar day in Buenos Aires', () => {
    expect(dateKeyInArgentina(new Date('2026-10-22T02:59:59.999Z'))).toBe('2026-10-21');
    expect(dateKeyInArgentina(new Date('2026-10-22T03:00:00.000Z'))).toBe('2026-10-22');
  });
});
