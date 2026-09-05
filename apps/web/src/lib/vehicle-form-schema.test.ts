import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getVehicleFormErrors,
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

test('vehicle form rejects mileage above the database range', () => {
  const result = vehicleFormSchema.safeParse({
    ...validVehicle,
    mileage: '2147483648',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.equal(getVehicleFormErrors(result.error).mileage, 'Ingresá un kilometraje válido');
});
