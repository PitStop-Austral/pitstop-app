import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SERVICE,
  isKnownService,
  OTHER_SERVICE,
  resolveServiceType,
  SERVICE_OPTIONS,
  serviceIconFor,
  toServiceFieldValue,
} from '../features/maintenances/service-catalog.ts';

const expectedServices = [
  'Cambio de aceite',
  'Filtros',
  'Filtro de aire',
  'Filtro de aceite',
  'Filtro de combustible',
  'Frenos',
  'Líquido de frenos',
  'Neumáticos',
  'Rotación de neumáticos',
  'Alineación de neumáticos',
  'Alineación y balanceo',
  'Batería',
  'Correa de distribución',
  'Motor',
  'Caja y transmisión',
  'Refrigerante',
  'Bujías',
  'Suspensión',
  'Turbo',
  'Luces',
  'Limpieza',
  'Otro',
];

const expectedIconFiles = [
  'oil.webp',
  'filter.webp',
  'filter.webp',
  'oil-filter.webp',
  'filter.webp',
  'wheels.webp',
  'general.webp',
  'wheels.webp',
  'wheels.webp',
  'wheels.webp',
  'wheels.webp',
  'batery.webp',
  'engine.webp',
  'engine.webp',
  'gear.webp',
  'refrigerante.webp',
  'spark-plug.webp',
  'suspension.webp',
  'turbo.webp',
  'light.webp',
  'clean.webp',
  'general.webp',
];

test('defines the canonical service catalog in the required order', () => {
  assert.equal(SERVICE_OPTIONS.length, 22);
  assert.deepStrictEqual(
    SERVICE_OPTIONS.map(({ name }) => name),
    expectedServices,
  );
  assert.deepStrictEqual(
    SERVICE_OPTIONS.map(({ icon }) => icon.split('/').at(-1)),
    expectedIconFiles,
  );
  assert.equal(DEFAULT_SERVICE, 'Cambio de aceite');
  assert.equal(OTHER_SERVICE, 'Otro');
});

test('matches known services without distinguishing letter case', () => {
  assert.equal(isKnownService('cambio de aceite'), true);
  assert.equal(isKnownService('FILTRO DE AIRE'), true);
  assert.equal(isKnownService(OTHER_SERVICE), false);
  assert.equal(isKnownService('Revisión de dirección'), false);
});

test('resolves known and unknown service icons', () => {
  assert.equal(serviceIconFor('cambio de aceite'), serviceIconFor(DEFAULT_SERVICE));
  assert.equal(serviceIconFor('Revisión de dirección'), serviceIconFor(OTHER_SERVICE));
});

test('converts stored service names to field values', () => {
  assert.deepStrictEqual(toServiceFieldValue(), { option: DEFAULT_SERVICE, customName: '' });
  assert.deepStrictEqual(toServiceFieldValue('filtro de aire'), {
    option: 'Filtro de aire',
    customName: '',
  });
  assert.deepStrictEqual(toServiceFieldValue('Revisión de dirección'), {
    option: OTHER_SERVICE,
    customName: 'Revisión de dirección',
  });
  assert.deepStrictEqual(toServiceFieldValue(OTHER_SERVICE), {
    option: OTHER_SERVICE,
    customName: OTHER_SERVICE,
  });
});

test('resolves canonical and trimmed custom service names', () => {
  assert.equal(
    resolveServiceType({ option: DEFAULT_SERVICE, customName: 'ignorado' }),
    DEFAULT_SERVICE,
  );
  assert.equal(
    resolveServiceType({ option: OTHER_SERVICE, customName: '  Revisión de dirección  ' }),
    'Revisión de dirección',
  );
  assert.equal(resolveServiceType({ option: OTHER_SERVICE, customName: '   ' }), '');
});
