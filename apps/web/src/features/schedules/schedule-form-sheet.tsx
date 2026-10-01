import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import { ServiceField } from '@/features/maintenances/service-field';
import { normalizeServiceType, resolveServiceType } from '@/features/maintenances/service-catalog';
import type { Vehicle } from '@/features/vehicles/types';
import { formatDate, formatNumber } from '@/lib/format';
import {
  getDisabledScheduleOptions,
  getInitialScheduleFormValues,
  getScheduleFormValues,
  parseScheduleForm,
} from './schedule-form-schema';
import type { ScheduleFormErrors, ScheduleFormValues } from './schedule-form-schema';
import { useCreateSchedule, useUpdateSchedule } from './queries';
import type { Schedule } from './types';

type ScheduleFormSheetProps = {
  open: boolean;
  vehicle: Vehicle;
  existingTypes: string[];
  schedule?: Schedule;
  onOpenChange: (open: boolean) => void;
};

function errorMessage(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : 'No pudimos guardar la frecuencia';
}

export function ScheduleFormSheet({
  open,
  vehicle,
  existingTypes,
  schedule,
  onOpenChange,
}: ScheduleFormSheetProps) {
  const formId = useId();
  const [values, setValues] = useState<ScheduleFormValues>(() =>
    schedule ? getScheduleFormValues(schedule) : getInitialScheduleFormValues(existingTypes),
  );
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const isEditing = Boolean(schedule);
  const isPending = createSchedule.isPending || updateSchedule.isPending;
  const otherTypes = schedule
    ? existingTypes.filter(
        (type) => normalizeServiceType(type) !== normalizeServiceType(schedule.type),
      )
    : existingTypes;
  const selectedType = resolveServiceType(values.service);
  const changesType = Boolean(
    schedule &&
    selectedType &&
    normalizeServiceType(selectedType) !== normalizeServiceType(schedule.type),
  );

  function updateField<Field extends keyof ScheduleFormValues>(
    field: Field,
    value: ScheduleFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const result = parseScheduleForm(values, otherTypes);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    try {
      if (schedule) {
        await updateSchedule.mutateAsync({
          vehicleId: vehicle.id,
          id: schedule.id,
          input: result.data,
        });
      } else {
        await createSchedule.mutateAsync({ vehicleId: vehicle.id, input: result.data });
      }
      onOpenChange(false);
      toast.success(isEditing ? 'Frecuencia actualizada' : 'Frecuencia creada');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <BottomSheet
      className="lg:max-w-2xl"
      description="Definí cada cuánto repetir este servicio"
      dismissible={!isPending}
      footer={
        <Button className="w-full gap-2" disabled={isPending} form={formId} type="submit">
          {isPending ? (
            <Icon className="animate-spin" color="on-primary" name="Loader2" size="sm" />
          ) : null}
          <Text color="on-primary" variant="label">
            {isPending ? 'Guardando...' : isEditing ? 'Guardar frecuencia' : 'Crear frecuencia'}
          </Text>
        </Button>
      }
      open={open}
      title={isEditing ? 'Editar frecuencia' : 'Nueva frecuencia'}
      onOpenChange={onOpenChange}
    >
      <form id={formId} noValidate onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-4" disabled={isPending}>
          <ServiceField
            disabledValues={getDisabledScheduleOptions(otherTypes)}
            error={errors.service}
            label="Mantenimiento"
            value={values.service}
            onChange={(service) => updateField('service', service)}
          />

          <div className="rounded-lg border border-border bg-neutral-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-md bg-foreground">
                <Icon color="inverse" name="Gauge" size="md" />
              </div>
              <div className="min-w-0 flex-1">
                <Text variant="body-strong">Por kilometraje</Text>
                <Text color="muted" variant="caption">
                  Avisar cada cierta cantidad de kilómetros
                </Text>
              </div>
              <Checkbox
                aria-label="Activar frecuencia por kilometraje"
                checked={values.useKm}
                onChange={(event) => updateField('useKm', event.target.checked)}
              />
            </label>
            {values.useKm ? (
              <FormField className="mt-4" error={errors.km} id="schedule-km" label="Cada">
                <div className="relative">
                  <Input
                    aria-describedby={errors.km ? 'schedule-km-error' : undefined}
                    aria-invalid={Boolean(errors.km)}
                    className="pr-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    id="schedule-km"
                    inputMode="numeric"
                    min={1}
                    placeholder="10000"
                    type="number"
                    value={values.km}
                    onChange={(event) => updateField('km', event.target.value)}
                  />
                  <Text
                    as="span"
                    className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
                    color="muted"
                    variant="caption"
                  >
                    km
                  </Text>
                </div>
              </FormField>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-neutral-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-md bg-foreground">
                <Icon color="inverse" name="CalendarDays" size="md" />
              </div>
              <div className="min-w-0 flex-1">
                <Text variant="body-strong">Por tiempo</Text>
                <Text color="muted" variant="caption">
                  Avisar después de una cantidad de meses
                </Text>
              </div>
              <Checkbox
                aria-label="Activar frecuencia por tiempo"
                checked={values.useMonths}
                onChange={(event) => updateField('useMonths', event.target.checked)}
              />
            </label>
            {values.useMonths ? (
              <FormField className="mt-4" error={errors.months} id="schedule-months" label="Cada">
                <div className="relative">
                  <Input
                    aria-describedby={errors.months ? 'schedule-months-error' : undefined}
                    aria-invalid={Boolean(errors.months)}
                    className="pr-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    id="schedule-months"
                    inputMode="numeric"
                    min={1}
                    placeholder="6"
                    type="number"
                    value={values.months}
                    onChange={(event) => updateField('months', event.target.value)}
                  />
                  <Text
                    as="span"
                    className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
                    color="muted"
                    variant="caption"
                  >
                    meses
                  </Text>
                </div>
              </FormField>
            ) : null}
          </div>

          {errors.intervals ? (
            <Text color="danger" variant="caption">
              {errors.intervals}
            </Text>
          ) : null}
          {schedule ? (
            <div className="rounded-lg bg-neutral-100 p-4">
              {changesType ? (
                <Text color="muted" variant="body">
                  La referencia se actualizará al guardar según el último mantenimiento de este
                  tipo. Si todavía no existe, se usarán la fecha y el kilometraje actuales.
                </Text>
              ) : (
                <Text color="muted" variant="body">
                  La próxima referencia se calcula desde el{' '}
                  <Text as="strong" variant="body-strong">
                    {formatDate(schedule.baselineDate)}
                  </Text>{' '}
                  y los{' '}
                  <Text as="strong" variant="body-strong">
                    {formatNumber(schedule.baselineMileage)} km
                  </Text>
                  .
                </Text>
              )}
            </div>
          ) : (
            <Text color="muted" variant="caption">
              La referencia inicial será el último registro de este tipo. Si todavía no existe, se
              usarán la fecha y el kilometraje actuales.
            </Text>
          )}
        </fieldset>
      </form>
    </BottomSheet>
  );
}
