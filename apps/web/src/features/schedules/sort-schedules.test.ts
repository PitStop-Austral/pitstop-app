import assert from 'node:assert/strict';
import test from 'node:test';
import { sortSchedules } from './sort-schedules.ts';
import type { Schedule } from './types.ts';

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: overrides.type ?? 'id',
    vehicleId: 'vehicle',
    type: 'Servicio',
    intervalMonths: null,
    intervalKm: null,
    baselineDate: '2026-01-01',
    baselineMileage: 0,
    nextDueDate: null,
    nextDueMileage: null,
    remainingDays: null,
    remainingKm: null,
    status: 'on_track',
    dueReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const types = (schedules: Schedule[]) => schedules.map((item) => item.type);

test('orders overdue, then upcoming, then on track', () => {
  const sorted = sortSchedules([
    schedule({ type: 'A', status: 'on_track', remainingDays: 1 }),
    schedule({ type: 'B', status: 'upcoming', remainingDays: 100 }),
    schedule({ type: 'C', status: 'overdue', remainingDays: 200 }),
  ]);
  assert.deepEqual(types(sorted), ['C', 'B', 'A']);
});

test('puts the most urgent first within a status', () => {
  const sorted = sortSchedules([
    schedule({ type: 'A', status: 'overdue', remainingDays: -1 }),
    schedule({ type: 'B', status: 'overdue', remainingDays: -200 }),
    schedule({ type: 'C', status: 'overdue', remainingDays: -1, remainingKm: -900 }),
    schedule({ type: 'D', status: 'overdue', remainingDays: -1, remainingKm: -100 }),
  ]);
  assert.deepEqual(types(sorted), ['B', 'C', 'D', 'A']);
});

test('sorts missing days and missing kilometers last', () => {
  const sorted = sortSchedules([
    schedule({ type: 'A', remainingKm: 100 }),
    schedule({ type: 'B', remainingDays: 300 }),
    schedule({ type: 'C', remainingDays: 300, remainingKm: 5000 }),
  ]);
  assert.deepEqual(types(sorted), ['C', 'B', 'A']);
});

test('breaks ties by type and does not mutate the input', () => {
  const input = [schedule({ type: 'Filtro' }), schedule({ type: 'Aceite' })];
  assert.deepEqual(types(sortSchedules(input)), ['Aceite', 'Filtro']);
  assert.deepEqual(types(input), ['Filtro', 'Aceite']);
});
