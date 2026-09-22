import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import type { Vehicle } from '@/features/vehicles/types';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  getInitialMaintenanceFormValues,
  getArgentinaDateValue,
  getMaintenanceFormErrors,
  getMaintenanceFormSchema,
} from './maintenance-form-schema';
import type { MaintenanceFormErrors, MaintenanceFormValues } from './maintenance-form-schema';
import { useCreateMaintenance } from './queries';
import { ServiceField } from './service-field';
import { CATEGORY_LABELS, MAINTENANCE_CATEGORIES } from './types';
import type { Maintenance, MaintenanceCategory } from './types';

type MaintenanceFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
  maintenance?: Maintenance;
};

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export function MaintenanceFormSheet({
  open,
  onOpenChange,
  vehicle,
  maintenance,
}: MaintenanceFormSheetProps) {
  const formId = useId();
  const categoryLabelId = useId();
  const [values, setValues] = useState<MaintenanceFormValues>(() =>
    getInitialMaintenanceFormValues(vehicle, maintenance),
  );
  const [errors, setErrors] = useState<MaintenanceFormErrors>({});
  const createMaintenance = useCreateMaintenance();
  const isPending = createMaintenance.isPending;

  function updateField<Field extends keyof MaintenanceFormValues>(
    field: Field,
    value: MaintenanceFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = getMaintenanceFormSchema().safeParse(values);

    if (!result.success) {
      setErrors(getMaintenanceFormErrors(result.error));
      return;
    }

    setErrors({});

    try {
      await createMaintenance.mutateAsync({ vehicleId: vehicle.id, input: result.data });
      onOpenChange(false);
      toast.success('Servicio registrado');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'No pudimos guardar el servicio');
    }
  }

  return (
    <BottomSheet
      description="Anotá el trabajo realizado"
      dismissible={!isPending}
      footer={
        <Button className="w-full gap-2" disabled={isPending} form={formId} type="submit">
          {isPending ? <Icon className="animate-spin" color="on-primary" name="Loader2" /> : null}
          <Text color="on-primary" variant="label">
            {isPending ? 'Guardando...' : 'Guardar servicio'}
          </Text>
        </Button>
      }
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar servicio"
    >
      <form
        aria-busy={isPending}
        className="flex flex-col gap-4"
        id={formId}
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="flex items-center gap-3 rounded-[14px] bg-neutral-100 p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-card shadow-sm">
            <Icon color="emphasis" name="CarFront" size={18} />
          </div>
          <div className="min-w-0">
            <Text className="truncate" variant="body-strong">
              {vehicle.brand} {vehicle.model}
            </Text>
            <Text className="mt-0.5 block truncate" color="muted" variant="caption">
              {vehicle.plate}
            </Text>
          </div>
        </div>

        <ServiceField
          error={errors.service}
          value={values.service}
          onChange={(service) => updateField('service', service)}
        />

        <div>
          <Text as="div" color="emphasis" id={categoryLabelId} variant="label">
            Tipo de servicio
          </Text>
          <div
            aria-labelledby={categoryLabelId}
            className="mt-2 grid grid-cols-2 gap-2.5"
            role="radiogroup"
          >
            {MAINTENANCE_CATEGORIES.map((category) => (
              <CategoryButton
                category={category}
                checked={values.category === category}
                disabled={isPending}
                key={category}
                onClick={() => updateField('category', category)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField error={errors.date} id="maintenance-date" label="Fecha">
            <Input
              aria-describedby={errors.date ? 'maintenance-date-error' : undefined}
              aria-invalid={Boolean(errors.date)}
              id="maintenance-date"
              max={getArgentinaDateValue()}
              type="date"
              value={values.date}
              onChange={(event) => updateField('date', event.target.value)}
            />
          </FormField>
          <FormField error={errors.mileage} id="maintenance-mileage" label="Kilometraje">
            <Input
              aria-describedby={errors.mileage ? 'maintenance-mileage-error' : undefined}
              aria-invalid={Boolean(errors.mileage)}
              id="maintenance-mileage"
              inputMode="numeric"
              min={0}
              placeholder="48000"
              type="number"
              value={values.mileage}
              onChange={(event) => updateField('mileage', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField error={errors.workshop} id="maintenance-workshop" label="Taller / lugar">
            <Input
              aria-describedby={errors.workshop ? 'maintenance-workshop-error' : undefined}
              aria-invalid={Boolean(errors.workshop)}
              id="maintenance-workshop"
              maxLength={80}
              placeholder="Lubricentro"
              value={values.workshop}
              onChange={(event) => updateField('workshop', event.target.value)}
            />
          </FormField>
          <FormField error={errors.cost} id="maintenance-cost" label="Costo">
            <Input
              aria-describedby={errors.cost ? 'maintenance-cost-error' : undefined}
              aria-invalid={Boolean(errors.cost)}
              id="maintenance-cost"
              inputMode="decimal"
              placeholder="42000"
              type="text"
              value={values.cost}
              onChange={(event) => updateField('cost', event.target.value)}
            />
          </FormField>
        </div>

        <FormField error={errors.notes} id="maintenance-notes" label="Notas (opcional)">
          <Textarea
            aria-describedby={errors.notes ? 'maintenance-notes-error' : undefined}
            aria-invalid={Boolean(errors.notes)}
            id="maintenance-notes"
            maxLength={500}
            placeholder="Detalles del servicio..."
            value={values.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />
        </FormField>
      </form>
    </BottomSheet>
  );
}

type CategoryButtonProps = {
  category: MaintenanceCategory;
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
};

function CategoryButton({ category, checked, disabled, onClick }: CategoryButtonProps) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        'h-12 rounded-[14px] border transition-all active:scale-[0.98]',
        checked
          ? 'border-foreground bg-foreground'
          : 'border-border bg-card hover:border-neutral-400',
      )}
      disabled={disabled}
      role="radio"
      type="button"
      onClick={onClick}
    >
      <Text color={checked ? 'inverse' : 'emphasis'} variant="body-strong">
        {CATEGORY_LABELS[category]}
      </Text>
    </button>
  );
}
