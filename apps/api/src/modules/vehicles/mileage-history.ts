import { argentinaDate } from '../schedules/schedule-date';
import { DAY_MS } from '../schedules/schedule-due';

export type MileageReadingSource = 'INITIAL' | 'MAINTENANCE' | 'UPDATE';
export type MileagePointSource = MileageReadingSource | 'WINDOW_START';

export type MileageReadingInput = {
  date: Date;
  mileage: number;
  source: MileageReadingSource;
  label?: string;
};

export type MileageHistoryPoint = {
  date: string;
  mileage: number;
  source: MileagePointSource;
  label?: string;
};

export type MileageHistory = {
  from: string;
  to: string;
  readingsCount: number;
  startMileage: number;
  currentMileage: number;
  kmInPeriod: number;
  averageMonthlyKm: number;
  points: MileageHistoryPoint[];
};

const DAYS_PER_MONTH = 30.44;

// Maintenance.date is a date without time (stored at UTC midnight), so it's taken as is;
// timestamps are converted to their Argentina calendar day.
function dayOf(reading: MileageReadingInput): string {
  const date = reading.source === 'MAINTENANCE' ? reading.date : argentinaDate(reading.date);
  return date.toISOString().slice(0, 10);
}

function minusOneYear(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

export function buildMileageHistory(readings: MileageReadingInput[], now: Date): MileageHistory {
  const to = argentinaDate(now).toISOString().slice(0, 10);
  let from = minusOneYear(to);

  const sorted = readings
    .map((reading) => ({ ...reading, day: dayOf(reading) }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.mileage - b.mileage);

  const points: MileageHistoryPoint[] = [];
  let max = -Infinity;
  let windowStartMileage: number | undefined;

  const before = sorted.filter((reading) => reading.day < from);
  if (before.length > 0) {
    max = Math.max(...before.map((reading) => reading.mileage));
    windowStartMileage = max;
    points.push({ date: from, mileage: max, source: 'WINDOW_START' });
  }

  // Future-dated readings are left out so no point lands to the right of "hoy".
  for (const reading of sorted.filter((item) => item.day >= from && item.day <= to)) {
    if (reading.mileage <= max) continue;
    max = reading.mileage;
    const point: MileageHistoryPoint = {
      date: reading.day,
      mileage: reading.mileage,
      source: reading.source,
      ...(reading.source === 'MAINTENANCE' && reading.label ? { label: reading.label } : {}),
    };
    // Sorted by km within a day, so a same-day point is always replaced by a higher one.
    if (points.at(-1)?.date === reading.day) points[points.length - 1] = point;
    else points.push(point);
  }

  // Nothing known before the window: the history starts at the first reading.
  if (before.length === 0 && points.length > 0) from = points[0].date;

  // A reading on the `from` day can replace the WINDOW_START point; its jump still counts.
  const startMileage = windowStartMileage ?? points[0]?.mileage ?? 0;
  const currentMileage = points.at(-1)?.mileage ?? 0;
  const kmInPeriod = currentMileage - startMileage;
  const days = (Date.parse(to) - Date.parse(from)) / DAY_MS;
  const months = Math.max(1, days / DAYS_PER_MONTH);

  return {
    from,
    to,
    readingsCount: readings.length,
    startMileage,
    currentMileage,
    kmInPeriod,
    // Floored: the ticket's example (11.450 km over 365 days) expects 954, which rounding
    // (954,9) would turn into 955.
    averageMonthlyKm: Math.floor(kmInPeriod / months),
    points,
  };
}
