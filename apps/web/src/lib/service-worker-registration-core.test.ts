import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createServiceWorkerRegistrationManager,
  type ServiceWorkerRegistrationCallbacks,
} from './service-worker-registration-core.ts';

test('retries registration after a failed attempt', async () => {
  let callbacks: ServiceWorkerRegistrationCallbacks | undefined;
  let attempts = 0;
  const manager = createServiceWorkerRegistrationManager({
    isSupported: () => true,
    start: (nextCallbacks) => {
      attempts += 1;
      callbacks = nextCallbacks;
    },
  });

  manager.register();
  const firstAttempt = manager.getRegistration();
  callbacks?.onError(new Error('temporary failure'));
  await assert.rejects(firstAttempt, /temporary failure/);

  const secondAttempt = manager.getRegistration();
  const registration = { scope: '/' } as ServiceWorkerRegistration;
  callbacks?.onRegistered(registration);

  assert.equal(await secondAttempt, registration);
  assert.equal(attempts, 2);
});

test('shares a successful in-flight registration attempt', async () => {
  let callbacks: ServiceWorkerRegistrationCallbacks | undefined;
  let attempts = 0;
  const manager = createServiceWorkerRegistrationManager({
    isSupported: () => true,
    start: (nextCallbacks) => {
      attempts += 1;
      callbacks = nextCallbacks;
    },
  });

  const firstAttempt = manager.getRegistration();
  const secondAttempt = manager.getRegistration();
  const registration = { scope: '/' } as ServiceWorkerRegistration;
  callbacks?.onRegistered(registration);

  assert.equal(firstAttempt, secondAttempt);
  assert.equal(await firstAttempt, registration);
  assert.equal(attempts, 1);
});
