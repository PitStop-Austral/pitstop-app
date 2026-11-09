import assert from 'node:assert/strict';
import test from 'node:test';

import { initialValues } from './vehicle-form-values.ts';
import { firstTabWithError, tabsWithErrors, VEHICLE_FORM_TABS } from './vehicle-form-tabs.ts';

test('returns every tab containing a validation error', () => {
  assert.deepStrictEqual(
    [...tabsWithErrors({ brand: 'Ingresá la marca', highBeam: 'Ingresá una luz válida' })],
    ['identificacion', 'luces'],
  );
});

test('returns the first tab with an error in form order', () => {
  assert.equal(
    firstTabWithError({
      rearTireSize: 'Ingresá una medida válida',
      plate: 'Ingresá una patente válida',
    }),
    'identificacion',
  );
  assert.equal(firstTabWithError({}), null);
});

test('assigns every vehicle form field to a tab', () => {
  const tabbedFields = new Set(VEHICLE_FORM_TABS.flatMap((tab) => tab.fields));

  for (const field of Object.keys(initialValues())) {
    assert.equal(tabbedFields.has(field as keyof ReturnType<typeof initialValues>), true, field);
  }
});
