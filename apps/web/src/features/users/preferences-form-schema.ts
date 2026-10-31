import { z } from 'zod';

const MAX_DAYS = 3650;
const MAX_KM = 500000;

function preferenceNumberSchema(
  emptyMessage: string,
  invalidMessage: string,
  max: number,
  normalize = (value: string) => value,
) {
  return z
    .string()
    .trim()
    .min(1, emptyMessage)
    .refine((value) => /^\d+$/.test(normalize(value)), invalidMessage)
    .transform(normalize)
    .transform(Number)
    .refine((value) => value <= max, invalidMessage);
}

export const preferencesFormSchema = z.object({
  upcomingThresholdDays: preferenceNumberSchema(
    'Ingresá una cantidad de días',
    'Usá un número entero entre 0 y 3650',
    MAX_DAYS,
  ),
  upcomingThresholdKm: preferenceNumberSchema(
    'Ingresá una cantidad de kilómetros',
    'Usá un número entero entre 0 y 500.000',
    MAX_KM,
    (value) => value.replaceAll('.', ''),
  ),
});

export type PreferencesFormValues = z.input<typeof preferencesFormSchema>;
export type PreferencesFormErrors = Partial<Record<keyof PreferencesFormValues, string>>;

export function getPreferencesFormErrors(
  error: z.ZodError<z.output<typeof preferencesFormSchema>>,
): PreferencesFormErrors {
  const fieldErrors = z.flattenError(error).fieldErrors;
  return {
    upcomingThresholdDays: fieldErrors.upcomingThresholdDays?.[0],
    upcomingThresholdKm: fieldErrors.upcomingThresholdKm?.[0],
  };
}
