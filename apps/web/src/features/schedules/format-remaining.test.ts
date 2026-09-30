import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRemaining } from './format-remaining.ts';

test('describes both criteria when both have margin', () => {
  assert.equal(formatRemaining(45, 1200), 'Faltan 45 días · faltan 1.200\u00A0km');
});

test('describes both criteria when both are overdue', () => {
  assert.equal(formatRemaining(-3, -500), 'Vencida hace 3 días · pasada por 500\u00A0km');
});

test('describes each criterion by its own sign', () => {
  assert.equal(formatRemaining(-3, 1200), 'Vencida hace 3 días · faltan 1.200\u00A0km');
  assert.equal(formatRemaining(20, -500), 'Faltan 20 días · pasada por 500\u00A0km');
});

test('omits a missing criterion', () => {
  assert.equal(formatRemaining(null, 1200), 'Faltan 1.200\u00A0km');
  assert.equal(formatRemaining(null, -500), 'Pasada por 500\u00A0km');
  assert.equal(formatRemaining(45, null), 'Faltan 45 días');
  assert.equal(formatRemaining(-3, null), 'Vencida hace 3 días');
  assert.equal(formatRemaining(null, null), null);
});

test('handles zero values', () => {
  assert.equal(formatRemaining(0, null), 'Venció hoy');
  assert.equal(formatRemaining(null, 0), 'Llegó al kilometraje');
  assert.equal(formatRemaining(0, 0), 'Venció hoy · llegó al kilometraje');
  assert.equal(formatRemaining(0, 300), 'Venció hoy · faltan 300\u00A0km');
});

test('uses singular for one day', () => {
  assert.equal(formatRemaining(1, null), 'Falta 1 día');
  assert.equal(formatRemaining(-1, null), 'Vencida hace 1 día');
});
