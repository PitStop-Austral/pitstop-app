import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getVehicleEditFormSchema,
  getVehicleFormErrors,
  getVehicleUpdateInput,
  vehicleFormSchema,
} from '../features/vehicles/vehicle-form-schema.ts';

const validVehicle = {
  brand: 'Honda',
  model: 'Civic',
  year: '2021',
  fuel: 'NAFTA' as const,
  plate: 'AF812KM',
  mileage: '48000',
  nickname: '',
};

test('vehicle form normalizes values for the API', () => {
  assert.deepStrictEqual(
    vehicleFormSchema.parse({
      ...validVehicle,
      brand: ' Honda ',
      plate: 'af 812 km',
      nickname: ' El del laburo ',
    }),
    {
      brand: 'Honda',
      model: 'Civic',
      year: 2021,
      fuel: 'NAFTA',
      plate: 'AF812KM',
      mileage: 48000,
      nickname: 'El del laburo',
    },
  );
});

test('vehicle form rejects impossible identification values per field', () => {
  const result = vehicleFormSchema.safeParse({
    ...validVehicle,
    brand: ' ',
    model: '',
    year: '1899',
    plate: 'ABC-123',
    mileage: '-1',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.deepStrictEqual(getVehicleFormErrors(result.error), {
    brand: 'Ingresá la marca',
    model: 'Ingresá el modelo',
    year: 'Ingresá un año válido',
    plate: 'Ingresá una patente válida',
    mileage: 'Ingresá un kilometraje válido',
  });
});

test('vehicle form accepts both Argentine plate formats', () => {
  assert.equal(vehicleFormSchema.safeParse({ ...validVehicle, plate: 'ABC123' }).success, true);
  assert.equal(vehicleFormSchema.safeParse({ ...validVehicle, plate: 'AB123CD' }).success, true);
});

test('vehicle create form rejects migration-only legacy plates', () => {
  assert.equal(
    vehicleFormSchema.safeParse({
      ...validVehicle,
      plate: 'LEGACY-123e4567-e89b-12d3-a456-426614174000',
    }).success,
    false,
  );
});

test('vehicle edit form accepts an unchanged legacy plate and omits it from the update', () => {
  const legacyPlate = 'LEGACY-123e4567-e89b-12d3-a456-426614174000';
  const result = getVehicleEditFormSchema(legacyPlate).safeParse({
    ...validVehicle,
    plate: legacyPlate,
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.deepStrictEqual(getVehicleUpdateInput(result.data, legacyPlate), {
    brand: 'Honda',
    model: 'Civic',
    year: 2021,
    fuel: 'NAFTA',
    mileage: 48000,
    nickname: null,
  });
});

test('vehicle edit form rejects a modified legacy plate', () => {
  const legacyPlate = 'LEGACY-123e4567-e89b-12d3-a456-426614174000';

  assert.equal(
    getVehicleEditFormSchema(legacyPlate).safeParse({
      ...validVehicle,
      plate: 'LEGACY-123e4567-e89b-12d3-a456-426614174001',
    }).success,
    false,
  );
});

test('vehicle edit form accepts a valid replacement for a legacy plate', () => {
  const legacyPlate = 'LEGACY-123e4567-e89b-12d3-a456-426614174000';
  const result = getVehicleEditFormSchema(legacyPlate).safeParse({
    ...validVehicle,
    plate: 'ab 123 cd',
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(getVehicleUpdateInput(result.data, legacyPlate).plate, 'AB123CD');
});

test('vehicle form rejects mileage above the database range', () => {
  const result = vehicleFormSchema.safeParse({
    ...validVehicle,
    mileage: '2147483648',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.equal(getVehicleFormErrors(result.error).mileage, 'Ingresá un kilometraje válido');
});
