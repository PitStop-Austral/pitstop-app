import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getArgentinaDateValue,
  getInitialMaintenanceFormValues,
  getMaintenanceFormErrors,
  getMaintenanceFormSchema,
} from './maintenance-form-schema.ts';
import type { Vehicle } from '../vehicles/types.ts';

const vehicle: Vehicle = {
  id: 'vehicle-1',
  brand: 'Honda',
  model: 'Civic',
  year: 2021,
  fuel: 'NAFTA',
  plate: 'AF812KM',
  mileage: 48250,
  nickname: null,
  engineOilType: null,
  engineOilLiters: null,
  gearboxOilType: null,
  gearboxOilLiters: null,
  transmission: null,
  frontTireSize: null,
  frontTirePressurePsi: null,
  rearTireSize: null,
  rearTirePressurePsi: null,
  highBeam: null,
  lowBeam: null,
  fogLight: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

test('maintenance form uses the Argentina calendar date and vehicle mileage', () => {
  const afterMidnightUtc = new Date('2026-09-18T01:30:00.000Z');

  assert.equal(getArgentinaDateValue(afterMidnightUtc), '2026-09-17');
  assert.deepStrictEqual(getInitialMaintenanceFormValues(vehicle, undefined, afterMidnightUtc), {
    service: { option: 'Cambio de aceite', customName: '' },
    category: 'MANTENIMIENTO',
    date: '2026-09-17',
    mileage: '48250',
    workshop: '',
    cost: '',
    notes: '',
  });
});

test('maintenance form resolves custom services and normalizes optional values', () => {
  const result = getMaintenanceFormSchema('2026-09-17').parse({
    service: { option: 'Otro', customName: '  Revisión de dirección  ' },
    category: 'ARREGLO',
    date: '2026-09-17',
    mileage: '50000',
    workshop: ' Taller Norte ',
    cost: '42000.50',
    notes: ' ',
  });

  assert.deepStrictEqual(result, {
    type: 'Revisión de dirección',
    category: 'ARREGLO',
    date: '2026-09-17',
    mileage: 50000,
    workshop: 'Taller Norte',
    cost: 42000.5,
    notes: null,
  });
});

test('maintenance form reports required fields, future dates, and invalid costs', () => {
  const result = getMaintenanceFormSchema('2026-09-17').safeParse({
    service: { option: 'Otro', customName: '   ' },
    category: 'MANTENIMIENTO',
    date: '2026-09-18',
    mileage: '',
    workshop: '',
    cost: '-1',
    notes: '',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.deepStrictEqual(getMaintenanceFormErrors(result.error), {
    service: 'Escribí el nombre del servicio',
    date: 'La fecha no puede ser futura',
    mileage: 'Ingresá el kilometraje',
    cost: 'Ingresá un costo válido',
  });
});

test('maintenance form rejects impossible dates, decimals in mileage, and excessive lengths', () => {
  const result = getMaintenanceFormSchema('2026-09-17').safeParse({
    service: { option: 'Cambio de aceite', customName: '' },
    category: 'MANTENIMIENTO',
    date: '2026-02-30',
    mileage: '100.5',
    workshop: 'a'.repeat(81),
    cost: '12.345',
    notes: 'a'.repeat(501),
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.deepStrictEqual(getMaintenanceFormErrors(result.error), {
    date: 'Elegí la fecha',
    mileage: 'Ingresá el kilometraje',
    workshop: 'Ingresá hasta 80 caracteres',
    cost: 'Ingresá un costo válido',
    notes: 'Ingresá hasta 500 caracteres',
  });
});
