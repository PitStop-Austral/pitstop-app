const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type KpiWindows = {
  date: Date;
  windowStart: Date;
  windowEnd: Date;
  thirtyDayWindowStart: Date;
};

export function dateKeyInArgentina(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function buildKpiWindows(date: string): KpiWindows {
  const storedDate = new Date(`${date}T00:00:00.000Z`);
  const windowStart = new Date(`${date}T03:00:00.000Z`);

  return {
    date: storedDate,
    windowStart,
    windowEnd: new Date(windowStart.getTime() + DAY_IN_MS),
    thirtyDayWindowStart: new Date(windowStart.getTime() - 29 * DAY_IN_MS),
  };
}
