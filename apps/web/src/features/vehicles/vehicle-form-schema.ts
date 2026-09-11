import { z } from 'zod';

import { FUEL_TYPES, TRANSMISSION_TYPES } from './types.ts';
import type { VehicleUpdateInput } from './types.ts';

const CURRENT_YEAR = new Date().getFullYear();
const MAX_VEHICLE_MILEAGE = 2_147_483_647;
const MAX_OIL_LITERS = 99.99;
const PLATE_PATTERN = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;
const LEGACY_PLATE_PATTERN =
  /^LEGACY-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

function normalizePlate(plate: string) {
  return plate.trim().toUpperCase().replace(/\s+/g, '');
}

function createPlateSchema(allowedLegacyPlate?: string) {
  return z
    .string()
    .trim()
    .transform(normalizePlate)
    .refine(
      (plate) => PLATE_PATTERN.test(plate) || plate === allowedLegacyPlate,
      'Ingresá una patente válida',
    );
}

function optionalTextSchema() {
  return z
    .string()
    .trim()
    .transform((value) => value || null);
}

function optionalNumberSchema(pattern: RegExp, message: string, max: number) {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), message)
    .transform((value) => (value === '' ? null : Number(value)))
    .refine((value) => value === null || value <= max, message);
}

export const vehicleFormSchema = z.object({
  brand: z.string().trim().min(1, 'Ingresá la marca'),
  model: z.string().trim().min(1, 'Ingresá el modelo'),
  year: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Ingresá un año válido')
    .transform(Number)
    .refine((year) => year >= 1900 && year <= CURRENT_YEAR + 1, 'Ingresá un año válido'),
  fuel: z.enum(FUEL_TYPES),
  plate: createPlateSchema(),
  mileage: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Ingresá un kilometraje válido')
    .transform(Number)
    .refine((mileage) => mileage <= MAX_VEHICLE_MILEAGE, 'Ingresá un kilometraje válido'),
  nickname: z
    .string()
    .trim()
    .transform((nickname) => nickname || null),
  engineOilType: optionalTextSchema(),
  engineOilLiters: optionalNumberSchema(
    /^\d+(\.\d{1,2})?$/,
    'Ingresá una cantidad válida',
    MAX_OIL_LITERS,
  ),
  gearboxOilType: optionalTextSchema(),
  gearboxOilLiters: optionalNumberSchema(
    /^\d+(\.\d{1,2})?$/,
    'Ingresá una cantidad válida',
    MAX_OIL_LITERS,
  ),
  transmission: z
    .union([z.enum(TRANSMISSION_TYPES), z.literal('')])
    .transform((value) => value || null),
  frontTireSize: optionalTextSchema(),
  frontTirePressurePsi: optionalNumberSchema(
    /^\d+$/,
    'Ingresá una presión válida',
    MAX_VEHICLE_MILEAGE,
  ),
  rearTireSize: optionalTextSchema(),
  rearTirePressurePsi: optionalNumberSchema(
    /^\d+$/,
    'Ingresá una presión válida',
    MAX_VEHICLE_MILEAGE,
  ),
  highBeam: optionalTextSchema(),
  lowBeam: optionalTextSchema(),
  fogLight: optionalTextSchema(),
});

export type VehicleFormValues = z.input<typeof vehicleFormSchema>;
type VehicleFormOutput = z.output<typeof vehicleFormSchema>;
export type VehicleFormErrors = Partial<Record<keyof VehicleFormValues, string>>;

const FORM_FIELDS = [
  'brand',
  'model',
  'year',
  'fuel',
  'plate',
  'mileage',
  'nickname',
  'engineOilType',
  'engineOilLiters',
  'gearboxOilType',
  'gearboxOilLiters',
  'transmission',
  'frontTireSize',
  'frontTirePressurePsi',
  'rearTireSize',
  'rearTirePressurePsi',
  'highBeam',
  'lowBeam',
  'fogLight',
] as const;

export function getVehicleEditFormSchema(existingPlate: string) {
  const normalizedPlate = normalizePlate(existingPlate);
  const allowedLegacyPlate = LEGACY_PLATE_PATTERN.test(normalizedPlate)
    ? normalizedPlate
    : undefined;

  return vehicleFormSchema.extend({ plate: createPlateSchema(allowedLegacyPlate) });
}

export function getVehicleUpdateInput(
  values: VehicleFormOutput,
  existingPlate: string,
): VehicleUpdateInput {
  const normalizedExistingPlate = normalizePlate(existingPlate);
  const input: VehicleUpdateInput = { ...values };

  if (
    LEGACY_PLATE_PATTERN.test(normalizedExistingPlate) &&
    values.plate === normalizedExistingPlate
  ) {
    delete input.plate;
  }

  return input;
}

export function getVehicleFormErrors(error: z.ZodError<VehicleFormOutput>): VehicleFormErrors {
  const fieldErrors = z.flattenError(error).fieldErrors;
  const errors: VehicleFormErrors = {};

  for (const field of FORM_FIELDS) {
    const message = fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }

  return errors;
}
