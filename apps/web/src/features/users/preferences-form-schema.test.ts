import assert from 'node:assert/strict';
import test from 'node:test';

import { preferencesFormSchema } from './preferences-form-schema.ts';

test('accepts zero thresholds and normalizes kilometre separators', () => {
  assert.deepEqual(
    preferencesFormSchema.parse({ upcomingThresholdDays: '0', upcomingThresholdKm: '1.500' }),
    { upcomingThresholdDays: 0, upcomingThresholdKm: 1500 },
  );
});

for (const upcomingThresholdDays of ['', '-1', '2,5', 'abc', '3651']) {
  test(`rejects an invalid day threshold: ${JSON.stringify(upcomingThresholdDays)}`, () => {
    assert.equal(
      preferencesFormSchema.safeParse({ upcomingThresholdDays, upcomingThresholdKm: '0' }).success,
      false,
    );
  });
}

for (const upcomingThresholdKm of ['', '-1', '2,5', 'abc', '500001']) {
  test(`rejects an invalid kilometre threshold: ${JSON.stringify(upcomingThresholdKm)}`, () => {
    assert.equal(
      preferencesFormSchema.safeParse({ upcomingThresholdDays: '0', upcomingThresholdKm }).success,
      false,
    );
  });
}
