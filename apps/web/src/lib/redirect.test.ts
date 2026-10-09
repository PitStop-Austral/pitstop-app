import assert from 'node:assert/strict';
import test from 'node:test';

import { getPostAuthRedirect, getSafeRedirect } from './redirect.ts';

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

test('post-auth redirect accepts protected paths', () => {
  assert.equal(getPostAuthRedirect('/garage'), '/garage');
  assert.equal(getPostAuthRedirect('/garage?x=1'), '/garage?x=1');
  assert.equal(getPostAuthRedirect('/'), '/');
});

test('post-auth redirect rejects public auth paths', () => {
  for (const value of [
    '/bienvenida',
    '/login?redirect=/garage',
    '/register#form',
    '/forgot-password/',
    '/Login',
    '/BIENVENIDA?redirect=/garage',
  ]) {
    assert.equal(getPostAuthRedirect(value), undefined, value);
  }
});

test('post-auth redirect keeps rejecting unsafe values', () => {
  for (const value of ['https://evil.com', '//evil.com', '/\\evil.com', 42, undefined]) {
    assert.equal(getPostAuthRedirect(value), undefined, String(value));
  }
});
