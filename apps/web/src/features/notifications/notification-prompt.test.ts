import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasOfferedNotificationPrompt,
  markNotificationPromptOffered,
  shouldOfferNotificationPrompt,
} from './notification-prompt.ts';

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test('offers the prompt when supported or when iOS needs installation', () => {
  for (const capability of ['supported', 'ios-install-required'] as const) {
    assert.equal(
      shouldOfferNotificationPrompt({ capability, alreadyOfferedOnThisDevice: false }),
      true,
    );
  }
});

test('does not offer the prompt when notifications are denied or unsupported', () => {
  for (const capability of ['denied', 'unsupported'] as const) {
    assert.equal(
      shouldOfferNotificationPrompt({ capability, alreadyOfferedOnThisDevice: false }),
      false,
    );
  }
});

test('does not offer the prompt again after it was shown on this device', () => {
  for (const capability of [
    'supported',
    'ios-install-required',
    'denied',
    'unsupported',
  ] as const) {
    assert.equal(
      shouldOfferNotificationPrompt({ capability, alreadyOfferedOnThisDevice: true }),
      false,
    );
  }
});

test('keeps prompt state separate for each Firebase user', () => {
  const storage = createStorage();

  markNotificationPromptOffered(storage, 'first-user');

  assert.equal(hasOfferedNotificationPrompt(storage, 'first-user'), true);
  assert.equal(hasOfferedNotificationPrompt(storage, 'second-user'), false);
});

test('tolerates storage access errors', () => {
  const unavailableStorage = {
    getItem: () => {
      throw new Error('Storage unavailable');
    },
    setItem: () => {
      throw new Error('Storage unavailable');
    },
  };

  assert.equal(hasOfferedNotificationPrompt(unavailableStorage, 'user'), false);
  assert.doesNotThrow(() => markNotificationPromptOffered(unavailableStorage, 'user'));
});
