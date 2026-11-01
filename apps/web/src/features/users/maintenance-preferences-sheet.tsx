import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { AxiosError } from 'axios';

import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';

import {
  getPreferencesFormErrors,
  preferencesFormSchema,
  type PreferencesFormErrors,
  type PreferencesFormValues,
} from './preferences-form-schema';
import { useUpdatePreferences } from './queries';

type MaintenancePreferencesSheetProps = {
  days: number;
  km: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MaintenancePreferencesSheet({
  days,
  km,
  open,
  onOpenChange,
}: MaintenancePreferencesSheetProps) {
  const formId = useId();
  const updatePreferences = useUpdatePreferences();
  const [values, setValues] = useState<PreferencesFormValues>({
    upcomingThresholdDays: String(days),
    upcomingThresholdKm: km.toLocaleString('es-AR'),
  });
  const [errors, setErrors] = useState<PreferencesFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setValues({
      upcomingThresholdDays: String(days),
      upcomingThresholdKm: km.toLocaleString('es-AR'),
    });
    setErrors({});
  }, [days, km, open]);

  function handleOpenChange(nextOpen: boolean): void {
    if (updatePreferences.isPending) return;
    onOpenChange(nextOpen);
  }

  function updateValue(field: keyof PreferencesFormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = preferencesFormSchema.safeParse(values);
    if (!result.success) {
      setErrors(getPreferencesFormErrors(result.error));
      return;
    }

    try {
      await updatePreferences.mutateAsync(result.data);
      onOpenChange(false);
      toast.success('Anticipación actualizada');
    } catch (error) {
      const message =
        error instanceof AxiosError && error.response?.status === 400
          ? (Array.isArray(error.response.data?.message)
              ? error.response.data.message[0]
              : error.response.data?.message) ||
            'No pudimos guardar la anticipación. Probá de nuevo.'
          : 'No pudimos guardar la anticipación. Probá de nuevo.';
      toast.error(message);
    }
  }

  return (
    <BottomSheet
      description="Un mantenimiento aparece como próximo cuando alcanza cualquiera de los dos umbrales."
      dismissible={!updatePreferences.isPending}
      footer={
        <Button
          className="w-full"
          disabled={updatePreferences.isPending}
          form={formId}
          type="submit"
        >
          <Text color="on-primary" variant="label">
            {updatePreferences.isPending ? 'Guardando…' : 'Guardar anticipación'}
          </Text>
        </Button>
      }
      open={open}
      title="Anticipación de avisos"
      onOpenChange={handleOpenChange}
    >
      <form aria-busy={updatePreferences.isPending} id={formId} noValidate onSubmit={handleSubmit}>
        <div className="space-y-4">
          <FormField
            error={errors.upcomingThresholdDays}
            id="upcoming-threshold-days"
            label="Avisar con anticipación de"
          >
            <div className="relative">
              <Input
                aria-describedby={
                  errors.upcomingThresholdDays ? 'upcoming-threshold-days-error' : undefined
                }
                aria-invalid={Boolean(errors.upcomingThresholdDays)}
                className="pr-14 font-mono tabular-nums"
                disabled={updatePreferences.isPending}
                id="upcoming-threshold-days"
                inputMode="numeric"
                value={values.upcomingThresholdDays}
                onChange={(event) => updateValue('upcomingThresholdDays', event.target.value)}
              />
              <Text
                className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
                color="subtle"
                variant="caption-strong"
              >
                días
              </Text>
            </div>
          </FormField>
          <FormField
            error={errors.upcomingThresholdKm}
            id="upcoming-threshold-km"
            label="O cuando falten"
          >
            <div className="relative">
              <Input
                aria-describedby={
                  errors.upcomingThresholdKm ? 'upcoming-threshold-km-error' : undefined
                }
                aria-invalid={Boolean(errors.upcomingThresholdKm)}
                className="pr-12 font-mono tabular-nums"
                disabled={updatePreferences.isPending}
                id="upcoming-threshold-km"
                inputMode="numeric"
                value={values.upcomingThresholdKm}
                onChange={(event) => updateValue('upcomingThresholdKm', event.target.value)}
              />
              <Text
                className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
                color="subtle"
                variant="caption-strong"
              >
                km
              </Text>
            </div>
          </FormField>
        </div>
      </form>
    </BottomSheet>
  );
}
