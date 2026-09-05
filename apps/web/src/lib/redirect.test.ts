import assert from 'node:assert/strict';
import test from 'node:test';

import { getSafeRedirect } from './redirect.ts';

test('accepts an internal path', () => {
  assert.equal(getSafeRedirect('/garage'), '/garage');
});

test('accepts an internal path with a query string', () => {
  assert.equal(getSafeRedirect('/garage?tab=history'), '/garage?tab=history');
});

test('rejects a missing value', () => {
  assert.equal(getSafeRedirect(undefined), undefined);
});

test('rejects a protocol-relative URL', () => {
  assert.equal(getSafeRedirect('//evil.com'), undefined);
});

test('rejects a backslash protocol-relative URL', () => {
  assert.equal(getSafeRedirect('/\\evil.com'), undefined);
});

test('rejects an absolute URL', () => {
  assert.equal(getSafeRedirect('https://evil.com'), undefined);
});

test('rejects a non-string value', () => {
  assert.equal(getSafeRedirect(42), undefined);
});
