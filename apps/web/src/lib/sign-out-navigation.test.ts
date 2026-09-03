import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSignOutNavigation } from './sign-out-navigation.ts';

test('manual sign-out (no options) navigates to a clean /login', () => {
  assert.deepStrictEqual(resolveSignOutNavigation('/garage'), {
    to: '/login',
    replace: true,
    search: {},
  });
});

test('preserveLocation: true keeps the current page as the redirect target', () => {
  assert.deepStrictEqual(resolveSignOutNavigation('/garage', { preserveLocation: true }), {
    to: '/login',
    replace: true,
    search: { redirect: '/garage' },
  });
});

test('preserveLocation: false matches the default (clean /login)', () => {
  assert.deepStrictEqual(resolveSignOutNavigation('/garage', { preserveLocation: false }), {
    to: '/login',
    replace: true,
    search: {},
  });
});
