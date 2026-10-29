import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginOptimisticNotificationPreference,
  resolveNotificationToggleAction,
  rollbackNotificationPreference,
} from './notification-preferences.ts';

test('disables the account independently of current browser registration', () => {
  assert.equal(
    resolveNotificationToggleAction({
      capability: 'supported',
      hasInstallationId: true,
      nextChecked: false,
      permission: 'granted',
    }),
    'disable-account',
  );
});

test('opens activation when permission or the local installation is missing', () => {
  assert.equal(
    resolveNotificationToggleAction({
      capability: 'supported',
      hasInstallationId: true,
      nextChecked: true,
      permission: 'default',
    }),
    'open-permission-sheet',
  );
  assert.equal(
    resolveNotificationToggleAction({
      capability: 'supported',
      hasInstallationId: false,
      nextChecked: true,
      permission: 'granted',
    }),
    'open-permission-sheet',
  );
});

test('always re-registers the exact current installation when permission is granted', () => {
  assert.equal(
    resolveNotificationToggleAction({
      capability: 'supported',
      hasInstallationId: true,
      nextChecked: true,
      permission: 'granted',
    }),
    'register-current-device',
  );
});

test('does not activate from an unavailable browser state', () => {
  for (const capability of ['checking', 'denied', 'unsupported', 'ios-install-required'] as const) {
    assert.equal(
      resolveNotificationToggleAction({
        capability,
        hasInstallationId: true,
        nextChecked: true,
        permission: null,
      }),
      'unavailable',
    );
  }
});

test('creates an immutable optimistic value so the previous user remains a rollback snapshot', () => {
  const previousUser = { id: 'user-1', notificationsEnabled: false };
  const update = beginOptimisticNotificationPreference(previousUser, true);

  assert.deepEqual(update.optimisticUser, { id: 'user-1', notificationsEnabled: true });
  assert.deepEqual(previousUser, { id: 'user-1', notificationsEnabled: false });
  assert.notEqual(update.optimisticUser, previousUser);
  assert.equal(rollbackNotificationPreference(update), previousUser);

  const emptyUpdate = beginOptimisticNotificationPreference(undefined, true);
  assert.equal(emptyUpdate.optimisticUser, undefined);
  assert.equal(rollbackNotificationPreference(emptyUpdate), undefined);
});
