import { ContractError } from './io.mjs';

// Argentina has no DST: the reporting day always starts at 03:00 UTC.
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export function parseDate(value) {
  const ms =
    typeof value === 'string' && DATE_PATTERN.test(value)
      ? Date.parse(`${value}T00:00:00.000Z`)
      : NaN;

  // The round trip rejects impossible dates such as 2026-02-30.
  if (Number.isNaN(ms) || toDay(ms) !== value) {
    throw new ContractError('INVALID_DATE');
  }

  return value;
}

// Inclusive start, exclusive end, both in UTC.
export function dayWindow(date) {
  const start = Date.parse(`${parseDate(date)}T00:00:00.000Z`) + ARGENTINA_OFFSET_MS;
  return {
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(start + DAY_MS).toISOString(),
  };
}

// The most recent Argentine day that has fully ended at `now`.
export function closedDay(now) {
  return toDay(now.getTime() - ARGENTINA_OFFSET_MS - DAY_MS);
}

export function assertClosedDay(date, now) {
  if (Date.parse(dayWindow(date).windowEnd) > now.getTime()) {
    throw new ContractError('DAY_NOT_CLOSED');
  }

  return date;
}
