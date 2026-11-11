// Pure geometry for the mileage evolution chart. Coordinates are percentages of a 0–100 box,
// shared by the SVG (viewBox 0 0 100 100) and the absolutely positioned point buttons.

type ChartPoint = { date: string; mileage: number };

const DAY_MS = 86_400_000;
const STEP_KM = 1000;
// Months whose 1st day gets an x-axis label (0-indexed: mar, jun, sep, dic).
const TICK_MONTHS: Record<number, string> = { 2: 'mar', 5: 'jun', 8: 'sep', 11: 'dic' };
// Ticks closer than this to the right edge would overlap the "hoy" label.
const MAX_TICK_X = 92;

export function xScale(from: string, to: string) {
  const start = Date.parse(from);
  const span = Date.parse(to) - start || DAY_MS;
  return (date: string) => ((Date.parse(date) - start) / span) * 100;
}

export function yBounds(points: ChartPoint[]): { min: number; max: number } {
  const min = Math.floor((points[0]?.mileage ?? 0) / STEP_KM) * STEP_KM;
  const max = Math.ceil((points.at(-1)?.mileage ?? 0) / STEP_KM) * STEP_KM;
  return { min, max: max === min ? min + STEP_KM : max };
}

export function yScale({ min, max }: { min: number; max: number }) {
  return (mileage: number) => 100 - ((mileage - min) / (max - min)) * 100;
}

export function linePath(coords: { x: number; y: number }[]): string {
  const [first, ...rest] = coords;
  if (!first) return '';
  return [
    `M ${first.x} ${first.y}`,
    ...rest.map(({ x, y }) => `H ${x} V ${y}`),
    // Stays flat until today.
    'H 100',
  ].join(' ');
}

export function areaPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  return `${linePath(coords)} V 100 H ${coords[0].x} Z`;
}

export function monthTicks(from: string, to: string): { label: string; x: number }[] {
  const x = xScale(from, to);
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00.000Z`);
  const ticks: { label: string; x: number }[] = [];

  while (cursor.toISOString().slice(0, 10) <= to) {
    const day = cursor.toISOString().slice(0, 10);
    const label = TICK_MONTHS[cursor.getUTCMonth()];
    if (label && day >= from && x(day) <= MAX_TICK_X) ticks.push({ label, x: x(day) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return ticks;
}
