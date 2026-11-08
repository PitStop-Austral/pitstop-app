import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasSeenVehicleOnboarding,
  markVehicleOnboardingSeen,
  shouldOfferVehicleOnboarding,
} from './vehicle-onboarding.ts';

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test('offers onboarding only to a user with no vehicles who has not seen it', () => {
  assert.equal(shouldOfferVehicleOnboarding({ vehicleCount: 0, alreadySeen: false }), true);
  assert.equal(shouldOfferVehicleOnboarding({ vehicleCount: 0, alreadySeen: true }), false);
  assert.equal(shouldOfferVehicleOnboarding({ vehicleCount: 1, alreadySeen: false }), false);
});

test('keeps onboarding state separate for each Firebase user', () => {
  const storage = createStorage();

  markVehicleOnboardingSeen(storage, 'first-user');

  assert.equal(hasSeenVehicleOnboarding(storage, 'first-user'), true);
  assert.equal(hasSeenVehicleOnboarding(storage, 'second-user'), false);
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

  assert.equal(hasSeenVehicleOnboarding(unavailableStorage, 'user'), false);
  assert.doesNotThrow(() => markVehicleOnboardingSeen(unavailableStorage, 'user'));
});
