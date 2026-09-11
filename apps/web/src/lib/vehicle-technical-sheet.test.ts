import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatOilSpecification,
  formatTechnicalText,
  formatTireSpecification,
} from '../features/vehicles/technical-sheet-display.ts';

test('formats complete technical specifications with their units', () => {
  assert.equal(formatOilSpecification('5W-30 sintético', 4.2), '5W-30 sintético · 4.2 L');
  assert.equal(formatTireSpecification('215/50 R17', 32), '215/50 R17 · 32 PSI');
});

test('falls back independently for partial paired specifications', () => {
  assert.equal(formatOilSpecification('5W-30 sintético', null), '5W-30 sintético · A definir');
  assert.equal(formatTireSpecification(null, 32), 'A definir · 32 PSI');
});

test('formats empty technical specifications without units', () => {
  assert.equal(formatTechnicalText(null), 'A definir');
  assert.equal(formatTechnicalText('   '), 'A definir');
  assert.equal(formatOilSpecification(null, null), 'A definir · A definir');
  assert.equal(formatTireSpecification(null, null), 'A definir · A definir');
});

test('preserves zero values and dot decimals', () => {
  assert.equal(formatOilSpecification(null, 0), 'A definir · 0 L');
  assert.equal(formatOilSpecification(null, 4.25), 'A definir · 4.25 L');
  assert.equal(formatTireSpecification(null, 0), 'A definir · 0 PSI');
});
