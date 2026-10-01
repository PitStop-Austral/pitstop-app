import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOrCreateInstallationId,
  getStoredInstallationId,
  INSTALLATION_ID_STORAGE_KEY,
} from './installation-id.ts';

function createStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(INSTALLATION_ID_STORAGE_KEY, initial);

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test('creates and persists one installation id', () => {
  const storage = createStorage();

  assert.equal(
    getOrCreateInstallationId(storage, () => 'generated-id'),
    'generated-id',
  );
  assert.equal(getStoredInstallationId(storage), 'generated-id');
  assert.equal(
    getOrCreateInstallationId(storage, () => 'different-id'),
    'generated-id',
  );
});

test('returns null before this browser has registered an installation id', () => {
  assert.equal(getStoredInstallationId(createStorage()), null);
});
