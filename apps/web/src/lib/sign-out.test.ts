import assert from 'node:assert/strict';
import test from 'node:test';

import { createSignOut, type SignOutDeps } from './sign-out.ts';

function createDeps(overrides: Partial<SignOutDeps> = {}) {
  const isSigningOutCalls: boolean[] = [];
  const deps: SignOutDeps = {
    prepare: async () => {},
    firebaseSignOut: async () => {},
    clearQueryCache: () => {},
    navigateToLanding: async () => {},
    onError: () => {},
    setIsSigningOut: (value) => isSigningOutCalls.push(value),
    ...overrides,
  };

  return { deps, isSigningOutCalls };
}

test('prepares the installation, signs out, clears the query cache, then navigates, in order', async () => {
  const order: string[] = [];
  const { deps } = createDeps({
    prepare: async () => {
      order.push('prepare');
    },
    firebaseSignOut: async () => {
      order.push('firebaseSignOut');
    },
    clearQueryCache: () => {
      order.push('clearQueryCache');
    },
    navigateToLanding: async () => {
      order.push('navigateToLanding');
    },
  });

  await createSignOut(deps)();

  assert.deepStrictEqual(order, [
    'prepare',
    'firebaseSignOut',
    'clearQueryCache',
    'navigateToLanding',
  ]);
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
  await Promise.resolve();

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
    navigateToLanding: async () => {
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

test('a manual cleanup failure keeps the Firebase session active for retry', async () => {
  const failure = new Error('cleanup failed');
  let firebaseSignOutCalls = 0;
  let reportedError: unknown;
  const { deps } = createDeps({
    prepare: async () => {
      throw failure;
    },
    firebaseSignOut: async () => {
      firebaseSignOutCalls += 1;
    },
    onError: (error) => {
      reportedError = error;
    },
  });

  await createSignOut(deps)('manual');

  assert.equal(firebaseSignOutCalls, 0);
  assert.equal(reportedError, failure);
});

test('an unauthorized logout completes locally when cleanup fails', async () => {
  let firebaseSignOutCalls = 0;
  const { deps } = createDeps({
    prepare: async () => {
      throw new Error('session expired');
    },
    firebaseSignOut: async () => {
      firebaseSignOutCalls += 1;
    },
  });

  await createSignOut(deps)('unauthorized');

  assert.equal(firebaseSignOutCalls, 1);
});

test('a concurrent unauthorized call promotes an in-flight manual logout', async () => {
  let rejectPreparation: (error: Error) => void = () => {};
  let firebaseSignOutCalls = 0;
  const { deps } = createDeps({
    prepare: () =>
      new Promise((_resolve, reject) => {
        rejectPreparation = reject;
      }),
    firebaseSignOut: async () => {
      firebaseSignOutCalls += 1;
    },
  });
  const signOut = createSignOut(deps);

  const manual = signOut('manual');
  const unauthorized = signOut('unauthorized');
  rejectPreparation(new Error('network failed'));
  await Promise.all([manual, unauthorized]);

  assert.equal(firebaseSignOutCalls, 1);
});
