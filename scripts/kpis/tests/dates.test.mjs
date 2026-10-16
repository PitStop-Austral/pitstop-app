import assert from 'node:assert/strict';
import test from 'node:test';

import { assertClosedDay, closedDay, dayWindow, parseDate } from '../dates.mjs';

test('the closed day changes at the Argentine midnight (03:00 UTC)', () => {
  assert.equal(closedDay(new Date('2026-10-22T02:59:59.999Z')), '2026-10-20');
  assert.equal(closedDay(new Date('2026-10-22T03:00:00.000Z')), '2026-10-21');
  // The schedule runs at 04:00 UTC = 01:00 in Argentina.
  assert.equal(closedDay(new Date('2026-10-22T04:00:00.000Z')), '2026-10-21');
});

test('the reporting window starts inclusively and ends exclusively at 03:00 UTC', () => {
  assert.deepEqual(dayWindow('2026-10-21'), {
    windowStart: '2026-10-21T03:00:00.000Z',
    windowEnd: '2026-10-22T03:00:00.000Z',
  });
  assert.deepEqual(dayWindow('2026-12-31'), {
    windowStart: '2026-12-31T03:00:00.000Z',
    windowEnd: '2027-01-01T03:00:00.000Z',
  });
});

test('accepts only real calendar dates in strict YYYY-MM-DD form', () => {
  assert.equal(parseDate('2028-02-29'), '2028-02-29');

  for (const value of [
    '2026-02-30',
    '2026-02-29',
    '2026-1-5',
    '2026-10-21T00:00',
    '20261021',
    '',
    undefined,
  ]) {
    assert.throws(() => parseDate(value), { code: 'INVALID_DATE' }, String(value));
  }
});

test('rejects open and future days', () => {
  assert.equal(assertClosedDay('2026-10-21', new Date('2026-10-22T03:00:00.000Z')), '2026-10-21');
  assert.throws(() => assertClosedDay('2026-10-21', new Date('2026-10-22T02:59:59.999Z')), {
    code: 'DAY_NOT_CLOSED',
  });
  assert.throws(() => assertClosedDay('2026-11-01', new Date('2026-10-22T04:00:00.000Z')), {
    code: 'DAY_NOT_CLOSED',
  });
});
