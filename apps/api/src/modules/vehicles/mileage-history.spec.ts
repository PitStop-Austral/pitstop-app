import { buildMileageHistory, MileageReadingInput } from './mileage-history';

// 2026-11-05 12:00 in Argentina (UTC-3).
const NOW = new Date('2026-11-05T15:00:00.000Z');

const initial = (date: string, mileage: number): MileageReadingInput => ({
  date: new Date(date),
  mileage,
  source: 'INITIAL',
});
const update = (date: string, mileage: number): MileageReadingInput => ({
  date: new Date(date),
  mileage,
  source: 'UPDATE',
});
const maintenance = (day: string, mileage: number, label: string): MileageReadingInput => ({
  date: new Date(`${day}T00:00:00.000Z`),
  mileage,
  source: 'MAINTENANCE',
  label,
});

describe('buildMileageHistory', () => {
  it('starts the line at the highest reading before the period', () => {
    const history = buildMileageHistory(
      [
        initial('2024-01-10T15:00:00.000Z', 20000),
        update('2025-06-01T15:00:00.000Z', 36800),
        maintenance('2025-03-01', 30000, 'Service'),
        maintenance('2025-12-18', 37900, 'Cambio de aceite y filtro'),
        update('2026-11-02T15:00:00.000Z', 48250),
      ],
      NOW,
    );

    expect(history).toEqual({
      from: '2025-11-05',
      to: '2026-11-05',
      readingsCount: 5,
      startMileage: 36800,
      currentMileage: 48250,
      kmInPeriod: 11450,
      averageMonthlyKm: 954,
      points: [
        { date: '2025-11-05', mileage: 36800, source: 'WINDOW_START' },
        {
          date: '2025-12-18',
          mileage: 37900,
          source: 'MAINTENANCE',
          label: 'Cambio de aceite y filtro',
        },
        { date: '2026-11-02', mileage: 48250, source: 'UPDATE' },
      ],
    });
  });

  it('drops a reading that does not beat the running max', () => {
    const history = buildMileageHistory(
      [
        update('2026-01-10T15:00:00.000Z', 40000),
        maintenance('2026-02-01', 39000, 'Service cargado tarde'),
        update('2026-03-10T15:00:00.000Z', 41000),
      ],
      NOW,
    );

    expect(history.points.map((point) => point.mileage)).toEqual([40000, 41000]);
  });

  it('keeps only the highest point when two readings share a day', () => {
    const history = buildMileageHistory(
      [
        update('2026-01-10T15:00:00.000Z', 40000),
        maintenance('2026-03-10', 41000, 'Service'),
        update('2026-03-10T20:00:00.000Z', 41500),
      ],
      NOW,
    );

    expect(history.points).toEqual([
      { date: '2026-01-10', mileage: 40000, source: 'UPDATE' },
      { date: '2026-03-10', mileage: 41500, source: 'UPDATE' },
    ]);
  });

  it('starts the period at the sign-up of a vehicle newer than a year', () => {
    const history = buildMileageHistory(
      [initial('2026-05-04T15:00:00.000Z', 10000), update('2026-11-01T15:00:00.000Z', 16000)],
      NOW,
    );

    expect(history.from).toBe('2026-05-04');
    expect(history.points[0]).toEqual({ date: '2026-05-04', mileage: 10000, source: 'INITIAL' });
    expect(history.kmInPeriod).toBe(6000);
  });

  it('ignores a missing initial mileage', () => {
    const history = buildMileageHistory([update('2026-02-01T15:00:00.000Z', 30000)], NOW);

    expect(history.readingsCount).toBe(1);
    expect(history.points).toEqual([{ date: '2026-02-01', mileage: 30000, source: 'UPDATE' }]);
  });

  it('starts at the first reading when an old vehicle has nothing before the period', () => {
    // Created two years ago before initialMileage existed: its first known km is inside the period.
    const history = buildMileageHistory(
      [update('2026-05-04T15:00:00.000Z', 30000), update('2026-11-01T15:00:00.000Z', 36000)],
      NOW,
    );

    expect(history.points.some((point) => point.source === 'WINDOW_START')).toBe(false);
    expect(history.from).toBe('2026-05-04');
    // 185 days ÷ 30,44 = 6,08 months → 6.000 / 6,08 = 987
    expect(history.averageMonthlyKm).toBe(987);
  });

  it('returns a single window-start point when nothing increased inside the period', () => {
    const history = buildMileageHistory(
      [initial('2024-01-10T15:00:00.000Z', 50000), update('2025-03-01T15:00:00.000Z', 52300)],
      NOW,
    );

    expect(history.points).toEqual([
      { date: '2025-11-05', mileage: 52300, source: 'WINDOW_START' },
    ]);
    expect(history.kmInPeriod).toBe(0);
    expect(history.averageMonthlyKm).toBe(0);
    expect(history.readingsCount).toBe(2);
  });

  it('counts a reading at 22:00 Argentina time on the first day as inside the period', () => {
    const history = buildMileageHistory(
      [
        update('2025-10-01T15:00:00.000Z', 36000),
        // 2025-11-05 22:00 in Argentina is 2025-11-06 01:00 UTC.
        update('2025-11-06T01:00:00.000Z', 36800),
      ],
      NOW,
    );

    expect(history.points).toEqual([{ date: '2025-11-05', mileage: 36800, source: 'UPDATE' }]);
  });

  it('counts the jump of a reading on the first day that replaces the window start', () => {
    const history = buildMileageHistory(
      [update('2025-10-01T15:00:00.000Z', 36000), update('2025-11-05T15:00:00.000Z', 36800)],
      NOW,
    );

    expect(history.points).toEqual([{ date: '2025-11-05', mileage: 36800, source: 'UPDATE' }]);
    expect(history.startMileage).toBe(36000);
    expect(history.kmInPeriod).toBe(800);
  });
});
