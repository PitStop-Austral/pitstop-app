import assert from 'node:assert/strict';
import test from 'node:test';
import { isIosDevice, resolveNotificationCapability } from './notification-support.ts';

const supportedEnvironment = {
  isIos: false,
  isStandalone: false,
  isSecureContext: true,
  hasNotificationApi: true,
  hasServiceWorkerApi: true,
  hasPushManagerApi: true,
  messagingSupported: true,
  permission: 'default' as NotificationPermission,
  hasVapidKey: true,
};

test('requires installation before requesting notification permission on iOS', () => {
  assert.equal(
    resolveNotificationCapability({
      ...supportedEnvironment,
      isIos: true,
      isStandalone: false,
    }),
    'ios-install-required',
  );
});

test('reports denied permission separately from missing browser support', () => {
  assert.equal(
    resolveNotificationCapability({ ...supportedEnvironment, permission: 'denied' }),
    'denied',
  );
  assert.equal(
    resolveNotificationCapability({ ...supportedEnvironment, messagingSupported: false }),
    'unsupported',
  );
});

test('recognizes iPadOS desktop user agents with touch input', () => {
  assert.equal(
    isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }),
    true,
  );
});
