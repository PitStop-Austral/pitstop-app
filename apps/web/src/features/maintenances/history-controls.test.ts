import assert from 'node:assert/strict';
import test from 'node:test';

import { filterAndSortMaintenances } from './history-controls.ts';
import type { Maintenance } from './types.ts';

function maintenance(overrides: Partial<Maintenance>): Maintenance {
  return {
    id: crypto.randomUUID(),
    vehicleId: 'vehicle-1',
    type: 'Cambio de aceite',
    category: 'MANTENIMIENTO',
    date: '2026-09-01',
    mileage: 50000,
    workshop: null,
    cost: null,
    notes: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

test('finds service type, workshop, and notes without case or accent differences', () => {
  const maintenances = [
    maintenance({ id: 'type', type: 'Revisión técnica' }),
    maintenance({ id: 'workshop', workshop: 'Taller Ñandú' }),
    maintenance({ id: 'notes', notes: 'Reemplazó la correa' }),
  ];

  assert.deepEqual(
    filterAndSortMaintenances(maintenances, {
      search: 'REVISION',
      category: 'TODOS',
      sort: 'date',
    }).map(({ id }) => id),
    ['type'],
  );
  assert.deepEqual(
    filterAndSortMaintenances(maintenances, {
      search: 'nandu',
      category: 'TODOS',
      sort: 'date',
    }).map(({ id }) => id),
    ['workshop'],
  );
  assert.deepEqual(
    filterAndSortMaintenances(maintenances, {
      search: 'CORREA',
      category: 'TODOS',
      sort: 'date',
    }).map(({ id }) => id),
    ['notes'],
  );
});

test('combines category and search filters', () => {
  const maintenances = [
    maintenance({ id: 'maintenance', type: 'Frenos', category: 'MANTENIMIENTO' }),
    maintenance({ id: 'repair', type: 'Frenos', category: 'ARREGLO' }),
  ];

  assert.deepEqual(
    filterAndSortMaintenances(maintenances, {
      search: 'frenos',
      category: 'ARREGLO',
      sort: 'date',
    }).map(({ id }) => id),
    ['repair'],
  );
});

test('sorts descending and keeps missing costs last with stable ties', () => {
  const maintenances = [
    maintenance({ id: 'older', date: '2026-01-01', mileage: 40000, cost: 100 }),
    maintenance({ id: 'first-tie', date: '2026-03-01', mileage: 60000, cost: 300 }),
    maintenance({ id: 'second-tie', date: '2026-03-01', mileage: 60000, cost: 300 }),
    maintenance({ id: 'without-cost', date: '2026-02-01', mileage: 50000, cost: null }),
  ];

  assert.deepEqual(
    filterAndSortMaintenances(maintenances, {
      search: '',
      category: 'TODOS',
      sort: 'date',
    }).map(({ id }) => id),
    ['first-tie', 'second-tie', 'without-cost', 'older'],
  );
  assert.deepEqual(
    filterAndSortMaintenances(maintenances, {
      search: '',
      category: 'TODOS',
      sort: 'mileage',
    }).map(({ id }) => id),
    ['first-tie', 'second-tie', 'without-cost', 'older'],
  );
  assert.deepEqual(
    filterAndSortMaintenances(maintenances, {
      search: '',
      category: 'TODOS',
      sort: 'cost',
    }).map(({ id }) => id),
    ['first-tie', 'second-tie', 'older', 'without-cost'],
  );
});
