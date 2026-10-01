import { z } from 'zod';
import {
  normalizeServiceType,
  OTHER_SERVICE,
  resolveServiceType,
  SERVICE_OPTIONS,
  toServiceFieldValue,
} from '../maintenances/service-catalog.ts';
import type { ServiceFieldValue } from '../maintenances/service-catalog.ts';
import type { Schedule, ScheduleInput } from './types.ts';

const MAX_INTERVAL = 2_147_483_647;
// Mirrors the API's MAX_SCHEDULE_INTERVAL_MONTHS (20 years).
const MAX_INTERVAL_MONTHS = 240;

export type ScheduleFormValues = {
  service: ServiceFieldValue;
  useMonths: boolean;
  months: string;
  useKm: boolean;
  km: string;
};

export type ScheduleFormErrors = Partial<Record<'service' | 'months' | 'km' | 'intervals', string>>;

export function getInitialScheduleFormValues(existingTypes: string[] = []): ScheduleFormValues {
  const taken = new Set(existingTypes.map(normalizeServiceType));
  const firstAvailable = SERVICE_OPTIONS.find(
    ({ name }) => name !== OTHER_SERVICE && !taken.has(normalizeServiceType(name)),
  );
  return {
    service: firstAvailable
      ? toServiceFieldValue(firstAvailable.name)
      : { option: OTHER_SERVICE, customName: '' },
    useMonths: false,
    months: '',
    useKm: false,
    km: '',
  };
}

export function getScheduleFormValues(schedule: Schedule): ScheduleFormValues {
  return {
    service: toServiceFieldValue(schedule.type),
    useMonths: schedule.intervalMonths !== null,
    months: schedule.intervalMonths?.toString() ?? '',
    useKm: schedule.intervalKm !== null,
    km: schedule.intervalKm?.toString() ?? '',
  };
}

export function getDisabledScheduleOptions(existingTypes: string[]): string[] {
  const customOption = normalizeServiceType(OTHER_SERVICE);
  return existingTypes.filter((type) => normalizeServiceType(type) !== customOption);
}

export function parseScheduleForm(
  values: ScheduleFormValues,
  existingTypes: string[],
): { success: true; data: ScheduleInput } | { success: false; errors: ScheduleFormErrors } {
  const errors: ScheduleFormErrors = {};
  const type = resolveServiceType(values.service);
  if (!type || type.length > 60) {
    errors.service = !type ? 'Escribí el nombre del servicio' : 'Ingresá hasta 60 caracteres';
  } else if (
    existingTypes.some((existing) => normalizeServiceType(existing) === normalizeServiceType(type))
  ) {
    errors.service = 'Ya existe una frecuencia para este servicio';
  }

  if (!values.useMonths && !values.useKm) errors.intervals = 'Elegí meses, kilómetros o ambos';

  function parseInterval(enabled: boolean, value: string, field: 'months' | 'km'): number | null {
    if (!enabled) return null;
    const result = z.coerce.number().int().min(1).safeParse(value.trim());
    if (!value.trim() || !/^\d+$/.test(value.trim()) || !result.success) {
      errors[field] = 'Ingresá un número entero mayor que cero';
      return null;
    }
    const max = field === 'months' ? MAX_INTERVAL_MONTHS : MAX_INTERVAL;
    if (result.data > max) {
      errors[field] =
        field === 'months'
          ? `Ingresá hasta ${MAX_INTERVAL_MONTHS} meses`
          : 'Ingresá un número entero mayor que cero';
      return null;
    }
    return result.data;
  }

  const intervalMonths = parseInterval(values.useMonths, values.months, 'months');
  const intervalKm = parseInterval(values.useKm, values.km, 'km');
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { type, intervalMonths, intervalKm } };
}
