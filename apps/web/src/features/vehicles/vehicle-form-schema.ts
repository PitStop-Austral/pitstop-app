import { z } from 'zod';

import { FUEL_TYPES } from './types.ts';

const CURRENT_YEAR = new Date().getFullYear();
const MAX_VEHICLE_MILEAGE = 2_147_483_647;
const PLATE_PATTERN = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;

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
  plate: z
    .string()
    .trim()
    .transform((plate) => plate.toUpperCase().replace(/\s+/g, ''))
    .refine((plate) => PLATE_PATTERN.test(plate), 'Ingresá una patente válida'),
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
});

export type VehicleFormValues = z.input<typeof vehicleFormSchema>;
type VehicleFormOutput = z.output<typeof vehicleFormSchema>;
export type VehicleFormErrors = Partial<Record<keyof VehicleFormValues, string>>;

const FORM_FIELDS = ['brand', 'model', 'year', 'fuel', 'plate', 'mileage', 'nickname'] as const;

export function getVehicleFormErrors(error: z.ZodError<VehicleFormOutput>): VehicleFormErrors {
  const fieldErrors = z.flattenError(error).fieldErrors;
  const errors: VehicleFormErrors = {};

  for (const field of FORM_FIELDS) {
    const message = fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }

  return errors;
}
