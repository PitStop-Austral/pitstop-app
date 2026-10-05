import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldBlockManualLogout } from './logout-policy.ts';

test('blocks manual logout when notification cleanup may still be active on the backend', () => {
  assert.equal(shouldBlockManualLogout(new Error('network failed')), true);
  assert.equal(shouldBlockManualLogout({ status: 0 }), true);
  assert.equal(shouldBlockManualLogout({ status: 500 }), true);
  assert.equal(shouldBlockManualLogout({ status: 503 }), true);
});

test('allows manual logout after definitive client responses', () => {
  assert.equal(shouldBlockManualLogout({ status: 400 }), false);
  assert.equal(shouldBlockManualLogout({ status: 401 }), false);
  assert.equal(shouldBlockManualLogout({ status: 404 }), false);
});
