import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCurrency, formatDate, formatNumber } from './format.ts';

test('formats thousands with a period separator', () => {
  assert.equal(formatNumber(48250), '48.250');
});

test('formats numbers under a thousand without a separator', () => {
  assert.equal(formatNumber(0), '0');
});

test('formats an ISO date as a short Spanish date', () => {
  assert.equal(formatDate('2026-03-12'), '12 mar 2026');
});

test('keeps the calendar day of an ISO date instead of shifting it in UTC', () => {
  assert.equal(formatDate('2026-01-01'), '01 ene 2026');
});

test('formats a whole cost without decimals and a cost with cents with two', () => {
  // es-AR puts a non-breaking space between the symbol and the amount.
  const format = (value: number) => formatCurrency(value).replace(/\s/g, ' ');
  assert.equal(format(42000), '$ 42.000');
  assert.equal(format(1.5), '$ 1,50');
  assert.equal(format(1234.56), '$ 1.234,56');
});
