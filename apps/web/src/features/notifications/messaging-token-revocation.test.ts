import assert from 'node:assert/strict';
import test from 'node:test';

import { revokeMessagingToken } from './messaging-token-revocation.ts';

test('rebinds messaging to the existing PWA worker before deleting a token after reload', async () => {
  const registration = { scope: '/' } as ServiceWorkerRegistration;
  const calls: string[] = [];
  let boundRegistration: ServiceWorkerRegistration | undefined;

  await revokeMessagingToken({
    isSupported: async () => true,
    getRegistration: async () => {
      calls.push('getRegistration');
      return registration;
    },
    bindTokenToRegistration: async (nextRegistration) => {
      calls.push('bindTokenToRegistration');
      boundRegistration = nextRegistration;
    },
    deleteToken: async () => {
      calls.push('deleteToken');
    },
  });

  assert.equal(boundRegistration, registration);
  assert.deepStrictEqual(calls, ['getRegistration', 'bindTokenToRegistration', 'deleteToken']);
});

test('does not touch the worker when Firebase Messaging is unsupported', async () => {
  let registrationRequested = false;

  await revokeMessagingToken({
    isSupported: async () => false,
    getRegistration: async () => {
      registrationRequested = true;
      return { scope: '/' } as ServiceWorkerRegistration;
    },
    bindTokenToRegistration: async () => {},
    deleteToken: async () => {},
  });

  assert.equal(registrationRequested, false);
});
