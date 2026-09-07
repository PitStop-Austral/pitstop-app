import type { FormEvent, ReactNode } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { useState } from 'react';
import { useCreateVehicle, useUpdateVehicle } from './queries';
import { FUEL_LABELS, FUEL_TYPES } from './types';
import type { FuelType, Vehicle } from './types';
import {
  getVehicleEditFormSchema,
  getVehicleFormErrors,
  getVehicleUpdateInput,
  vehicleFormSchema,
} from './vehicle-form-schema';
import type { VehicleFormErrors, VehicleFormValues } from './vehicle-form-schema';

type CommonProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type VehicleFormSheetProps = CommonProps &
  (
    | { mode: 'add'; vehicle?: never }
    | {
        mode: 'edit';
        vehicle: Vehicle;
      }
  );

const FORM_ID = 'vehicle-form';

function initialValues(vehicle?: Vehicle): VehicleFormValues {
  return {
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: vehicle ? String(vehicle.year) : '',
    fuel: vehicle?.fuel ?? 'NAFTA',
    plate: vehicle?.plate ?? '',
    mileage: vehicle ? String(vehicle.mileage) : '',
    nickname: vehicle?.nickname ?? '',
  };
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export function VehicleFormSheet(props: VehicleFormSheetProps) {
  const [values, setValues] = useState<VehicleFormValues>(() => initialValues(props.vehicle));
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const isPending = createVehicle.isPending || updateVehicle.isPending;

  function updateField<Field extends keyof VehicleFormValues>(
    field: Field,
    value: VehicleFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const schema =
      props.mode === 'edit' ? getVehicleEditFormSchema(props.vehicle.plate) : vehicleFormSchema;
    const result = schema.safeParse(values);

    if (!result.success) {
      setErrors(getVehicleFormErrors(result.error));
      return;
    }

    setErrors({});

    try {
      if (props.mode === 'add') {
        await createVehicle.mutateAsync(result.data);
      } else {
        await updateVehicle.mutateAsync({
          id: props.vehicle.id,
          input: getVehicleUpdateInput(result.data, props.vehicle.plate),
        });
      }

      props.onOpenChange(false);
      toast.success(props.mode === 'add' ? 'Vehículo guardado' : 'Cambios guardados');
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setErrors({ plate: error.message });
        return;
      }

      toast.error(isApiError(error) ? error.message : 'No pudimos guardar el vehículo');
    }
  }

  const title = props.mode === 'add' ? 'Agregar vehículo' : 'Editar vehículo';
  const submitLabel = props.mode === 'add' ? 'Guardar vehículo' : 'Guardar cambios';

  return (
    <BottomSheet
      description="Completá la ficha con los datos que tengas disponibles"
      footer={
        <Button className="w-full gap-2" disabled={isPending} form={FORM_ID} type="submit">
          {isPending ? <Icon className="animate-spin" color="on-primary" name="Loader2" /> : null}
          <Text color="on-primary" variant="label">
            {isPending ? 'Guardando...' : submitLabel}
          </Text>
        </Button>
      }
      dismissible={!isPending}
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
    >
      <form aria-busy={isPending} id={FORM_ID} noValidate onSubmit={handleSubmit}>
        <div className="rounded-[20px] border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-[12px] bg-neutral-100 shadow-sm">
              <Icon color="emphasis" name="CarFront" size="md" />
            </div>
            <Text variant="subheading">Identificación</Text>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5">
            <FormField error={errors.brand} id="vehicle-brand" label="Marca">
              <Input
                aria-describedby={errors.brand ? 'vehicle-brand-error' : undefined}
                aria-invalid={Boolean(errors.brand)}
                autoComplete="organization"
                id="vehicle-brand"
                placeholder="Honda"
                value={values.brand}
                onChange={(event) => updateField('brand', event.target.value)}
              />
            </FormField>

            <FormField error={errors.model} id="vehicle-model" label="Modelo">
              <Input
                aria-describedby={errors.model ? 'vehicle-model-error' : undefined}
                aria-invalid={Boolean(errors.model)}
                id="vehicle-model"
                placeholder="Civic"
                value={values.model}
                onChange={(event) => updateField('model', event.target.value)}
              />
            </FormField>

            <FormField error={errors.year} id="vehicle-year" label="Año">
              <Input
                aria-describedby={errors.year ? 'vehicle-year-error' : undefined}
                aria-invalid={Boolean(errors.year)}
                id="vehicle-year"
                inputMode="numeric"
                max={new Date().getFullYear() + 1}
                min={1900}
                placeholder="2021"
                type="number"
                value={values.year}
                onChange={(event) => updateField('year', event.target.value)}
              />
            </FormField>

            <FormField error={errors.fuel} id="vehicle-fuel" label="Combustible">
              <Select
                aria-describedby={errors.fuel ? 'vehicle-fuel-error' : undefined}
                aria-invalid={Boolean(errors.fuel)}
                id="vehicle-fuel"
                value={values.fuel}
                onChange={(event) => updateField('fuel', event.target.value as FuelType)}
              >
                {FUEL_TYPES.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {FUEL_LABELS[fuel]}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField error={errors.plate} id="vehicle-plate" label="Patente">
              <Input
                aria-describedby={errors.plate ? 'vehicle-plate-error' : undefined}
                aria-invalid={Boolean(errors.plate)}
                autoCapitalize="characters"
                id="vehicle-plate"
                placeholder="AF 812 KM"
                value={values.plate}
                onChange={(event) => updateField('plate', event.target.value.toUpperCase())}
              />
            </FormField>

            <FormField error={errors.mileage} id="vehicle-mileage" label="Kilometraje">
              <div className="relative">
                <Input
                  aria-describedby={errors.mileage ? 'vehicle-mileage-error' : undefined}
                  aria-invalid={Boolean(errors.mileage)}
                  className="pr-12"
                  id="vehicle-mileage"
                  inputMode="numeric"
                  min={0}
                  placeholder="48000"
                  type="number"
                  value={values.mileage}
                  onChange={(event) => updateField('mileage', event.target.value)}
                />
                <Text
                  className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
                  color="subtle"
                  variant="caption-strong"
                >
                  km
                </Text>
              </div>
            </FormField>

            <FormField
              className="col-span-2"
              error={errors.nickname}
              id="vehicle-nickname"
              label="Apodo (opcional)"
            >
              <Input
                aria-describedby={errors.nickname ? 'vehicle-nickname-error' : undefined}
                aria-invalid={Boolean(errors.nickname)}
                id="vehicle-nickname"
                placeholder="El del laburo"
                value={values.nickname}
                onChange={(event) => updateField('nickname', event.target.value)}
              />
            </FormField>
          </div>
        </div>
      </form>
    </BottomSheet>
  );
}

type FormFieldProps = {
  children: ReactNode;
  className?: string;
  error?: string;
  id: string;
  label: string;
};

function FormField({ children, className, error, id, label }: FormFieldProps) {
  return (
    <div className={className}>
      <Text as="label" className="mb-2 block" color="emphasis" htmlFor={id} variant="label">
        {label}
      </Text>
      {children}
      {error ? (
        <Text className="mt-1.5 block" color="danger" id={`${id}-error`} variant="caption">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
