import assert from 'node:assert/strict';
import test from 'node:test';

import { createSignOut, type SignOutDeps } from './sign-out.ts';

function createDeps(overrides: Partial<SignOutDeps> = {}) {
  const isSigningOutCalls: boolean[] = [];
  const deps: SignOutDeps = {
    firebaseSignOut: async () => {},
    clearQueryCache: () => {},
    navigateToLogin: async () => {},
    onError: () => {},
    setIsSigningOut: (value) => isSigningOutCalls.push(value),
    ...overrides,
  };

  return { deps, isSigningOutCalls };
}

test('runs firebaseSignOut, clears the query cache, then navigates, in order', async () => {
  const order: string[] = [];
  const { deps } = createDeps({
    firebaseSignOut: async () => {
      order.push('firebaseSignOut');
    },
    clearQueryCache: () => {
      order.push('clearQueryCache');
    },
    navigateToLogin: async () => {
      order.push('navigateToLogin');
    },
  });

  await createSignOut(deps)();

  assert.deepStrictEqual(order, ['firebaseSignOut', 'clearQueryCache', 'navigateToLogin']);
});

test('toggles isSigningOut true then false around a successful call', async () => {
  const { deps, isSigningOutCalls } = createDeps();

  await createSignOut(deps)();

  assert.deepStrictEqual(isSigningOutCalls, [true, false]);
});

test('a second concurrent call returns the same in-flight promise instead of running again', async () => {
  let firebaseSignOutCalls = 0;
  let resolveFirebaseSignOut: () => void = () => {};
  const { deps } = createDeps({
    firebaseSignOut: () =>
      new Promise((resolve) => {
        firebaseSignOutCalls += 1;
        resolveFirebaseSignOut = resolve;
      }),
  });
  const signOut = createSignOut(deps);

  const first = signOut();
  const second = signOut();

  assert.strictEqual(first, second);
  assert.strictEqual(firebaseSignOutCalls, 1);

  resolveFirebaseSignOut();
  await first;
});

test('a call after the previous one has settled starts a fresh run', async () => {
  let firebaseSignOutCalls = 0;
  const { deps } = createDeps({
    firebaseSignOut: async () => {
      firebaseSignOutCalls += 1;
    },
  });
  const signOut = createSignOut(deps);

  await signOut();
  await signOut();

  assert.strictEqual(firebaseSignOutCalls, 2);
});

test('reports a firebaseSignOut failure via onError instead of throwing, and still resets isSigningOut', async () => {
  const thrown = new Error('boom');
  let reportedError: unknown;
  const { deps, isSigningOutCalls } = createDeps({
    firebaseSignOut: async () => {
      throw thrown;
    },
    onError: (error) => {
      reportedError = error;
    },
  });

  await assert.doesNotReject(createSignOut(deps)());

  assert.strictEqual(reportedError, thrown);
  assert.deepStrictEqual(isSigningOutCalls, [true, false]);
});

test('does not clear the query cache or navigate when firebaseSignOut fails', async () => {
  let clearCalled = false;
  let navigateCalled = false;
  const { deps } = createDeps({
    firebaseSignOut: async () => {
      throw new Error('boom');
    },
    clearQueryCache: () => {
      clearCalled = true;
    },
    navigateToLogin: async () => {
      navigateCalled = true;
    },
  });

  await createSignOut(deps)();

  assert.strictEqual(clearCalled, false);
  assert.strictEqual(navigateCalled, false);
});

test('a failed run does not stay "in flight" - a later call can still succeed', async () => {
  let attempt = 0;
  const { deps } = createDeps({
    firebaseSignOut: async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('boom');
      }
    },
  });
  const signOut = createSignOut(deps);

  await signOut();
  await signOut();

  assert.strictEqual(attempt, 2);
});
