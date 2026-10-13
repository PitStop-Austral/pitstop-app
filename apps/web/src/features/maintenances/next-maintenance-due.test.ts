import assert from 'node:assert/strict';
import test from 'node:test';

import { getNextMaintenanceDue } from './next-maintenance-due.ts';

const schedule = {
  type: 'Cambio de aceite',
  nextDueDate: '2027-03-05',
  nextDueMileage: 140000,
};

test('formats the available due date and mileage for a matching service', () => {
  assert.equal(getNextMaintenanceDue('CAMBIO DE ACEITE', [schedule]), '05 mar 2027 · 140.000 km');
  assert.equal(
    getNextMaintenanceDue('Cambio de aceite', [{ ...schedule, nextDueMileage: null }]),
    '05 mar 2027',
  );
  assert.equal(
    getNextMaintenanceDue('Cambio de aceite', [{ ...schedule, nextDueDate: null }]),
    '140.000 km',
  );
  assert.equal(getNextMaintenanceDue('Batería', [schedule]), null);
});
