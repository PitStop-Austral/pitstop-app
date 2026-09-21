import { z } from 'zod';

import { resolveServiceType, toServiceFieldValue } from './service-catalog.ts';
import type { ServiceFieldValue } from './service-catalog.ts';
import { MAINTENANCE_CATEGORIES } from './types.ts';
import type { Maintenance, MaintenanceInput } from './types.ts';
import type { Vehicle } from '../vehicles/types.ts';

const MAX_VEHICLE_MILEAGE = 2_147_483_647;
const MAX_MAINTENANCE_COST = 9_999_999_999.99;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isServiceFieldValue(value: unknown): value is ServiceFieldValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'option' in value &&
    typeof value.option === 'string' &&
    'customName' in value &&
    typeof value.customName === 'string'
  );
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionalTextSchema(maxLength: number, message: string) {
  return z
    .string()
    .trim()
    .max(maxLength, message)
    .transform((value) => value || null);
}

const serviceSchema = z
  .custom<ServiceFieldValue>(isServiceFieldValue)
  .refine((value) => resolveServiceType(value).length > 0, 'Escribí el nombre del servicio')
  .refine((value) => resolveServiceType(value).length <= 60, 'Ingresá hasta 60 caracteres');

export function getLocalDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMaintenanceFormSchema(today = getLocalDateValue()) {
  return z
    .object({
      service: serviceSchema,
      category: z.enum(MAINTENANCE_CATEGORIES),
      date: z
        .string()
        .trim()
        .refine(isCalendarDate, 'Elegí la fecha')
        .refine(
          (value) => !isCalendarDate(value) || value <= today,
          'La fecha no puede ser futura',
        ),
      mileage: z
        .string()
        .trim()
        .regex(/^\d+$/, 'Ingresá el kilometraje')
        .transform(Number)
        .refine((value) => value <= MAX_VEHICLE_MILEAGE, 'Ingresá el kilometraje'),
      workshop: optionalTextSchema(80, 'Ingresá hasta 80 caracteres'),
      cost: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value),
          'Ingresá un costo válido',
        )
        .transform((value) => (value === '' ? null : Number(value)))
        .refine(
          (value) => value === null || value <= MAX_MAINTENANCE_COST,
          'Ingresá un costo válido',
        ),
      notes: optionalTextSchema(500, 'Ingresá hasta 500 caracteres'),
    })
    .transform(({ service, ...values }): MaintenanceInput => ({
      ...values,
      type: resolveServiceType(service),
    }));
}

export type MaintenanceFormValues = z.input<ReturnType<typeof getMaintenanceFormSchema>>;
export type MaintenanceFormErrors = Partial<Record<keyof MaintenanceFormValues, string>>;

const FORM_FIELDS = [
  'service',
  'category',
  'date',
  'mileage',
  'workshop',
  'cost',
  'notes',
] as const;

export function getMaintenanceFormErrors(error: z.ZodError): MaintenanceFormErrors {
  const fieldErrors = z.flattenError(error).fieldErrors as Partial<
    Record<keyof MaintenanceFormValues, string[]>
  >;
  const errors: MaintenanceFormErrors = {};

  for (const field of FORM_FIELDS) {
    const message = fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }

  return errors;
}

export function getInitialMaintenanceFormValues(
  vehicle: Vehicle,
  maintenance?: Maintenance,
  today = new Date(),
): MaintenanceFormValues {
  return {
    service: toServiceFieldValue(maintenance?.type),
    category: maintenance?.category ?? 'MANTENIMIENTO',
    date: maintenance?.date ?? getLocalDateValue(today),
    mileage: String(maintenance?.mileage ?? vehicle.mileage),
    workshop: maintenance?.workshop ?? '',
    cost: maintenance?.cost === null ? '' : String(maintenance?.cost ?? ''),
    notes: maintenance?.notes ?? '',
  };
}
