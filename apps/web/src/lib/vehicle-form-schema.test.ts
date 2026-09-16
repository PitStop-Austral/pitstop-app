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
  engineOilType: '',
  engineOilLiters: '',
  gearboxOilType: '',
  gearboxOilLiters: '',
  transmission: '' as const,
  frontTireSize: '',
  frontTirePressurePsi: '',
  rearTireSize: '',
  rearTirePressurePsi: '',
  highBeam: '',
  lowBeam: '',
  fogLight: '',
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
    },
  );
});

test('vehicle form normalizes a complete technical sheet', () => {
  assert.deepStrictEqual(
    vehicleFormSchema.parse({
      ...validVehicle,
      engineOilType: ' 5W-30 sintético ',
      engineOilLiters: '4.2',
      gearboxOilType: ' ATF DW-1 ',
      gearboxOilLiters: '3.1',
      transmission: 'MANUAL',
      frontTireSize: ' 215/50 R17 ',
      frontTirePressurePsi: '32',
      rearTireSize: ' 215/50 R17 ',
      rearTirePressurePsi: '30',
      highBeam: ' H11 ',
      lowBeam: ' H7 ',
      fogLight: ' H8 ',
    }),
    {
      brand: 'Honda',
      model: 'Civic',
      year: 2021,
      fuel: 'NAFTA',
      plate: 'AF812KM',
      mileage: 48000,
      nickname: null,
      engineOilType: '5W-30 sintético',
      engineOilLiters: 4.2,
      gearboxOilType: 'ATF DW-1',
      gearboxOilLiters: 3.1,
      transmission: 'MANUAL',
      frontTireSize: '215/50 R17',
      frontTirePressurePsi: 32,
      rearTireSize: '215/50 R17',
      rearTirePressurePsi: 30,
      highBeam: 'H11',
      lowBeam: 'H7',
      fogLight: 'H8',
    },
  );
});

test('vehicle form rejects invalid technical quantities and pressures', () => {
  const result = vehicleFormSchema.safeParse({
    ...validVehicle,
    engineOilLiters: 'cuatro',
    gearboxOilLiters: '3.123',
    frontTirePressurePsi: '32.5',
    rearTirePressurePsi: '-1',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.deepStrictEqual(getVehicleFormErrors(result.error), {
    engineOilLiters: 'Ingresá una cantidad válida',
    gearboxOilLiters: 'Ingresá una cantidad válida',
    frontTirePressurePsi: 'Ingresá una presión válida',
    rearTirePressurePsi: 'Ingresá una presión válida',
  });
});

test('vehicle form sends cleared technical fields as null', () => {
  const result = vehicleFormSchema.parse({
    ...validVehicle,
    engineOilType: ' ',
    engineOilLiters: '',
    transmission: '',
    frontTirePressurePsi: '',
  });

  assert.equal(result.engineOilType, null);
  assert.equal(result.engineOilLiters, null);
  assert.equal(result.transmission, null);
  assert.equal(result.frontTirePressurePsi, null);
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
