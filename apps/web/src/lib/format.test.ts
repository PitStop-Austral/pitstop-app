import assert from 'node:assert/strict';
import test from 'node:test';

import { formatNumber } from './format.ts';

test('formats thousands with a period separator', () => {
  assert.equal(formatNumber(48250), '48.250');
});

test('formats numbers under a thousand without a separator', () => {
  assert.equal(formatNumber(0), '0');
});
