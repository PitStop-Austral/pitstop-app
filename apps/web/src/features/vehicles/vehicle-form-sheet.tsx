import { useId, useState } from 'react';
import type { ComponentProps, FormEvent, ReactNode } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { useCreateVehicle, useUpdateVehicle } from './queries';
import { FUEL_LABELS, FUEL_TYPES, TRANSMISSION_LABELS, TRANSMISSION_TYPES } from './types';
import type { FuelType, TransmissionType, Vehicle } from './types';
import { VEHICLE_SECTION_ICONS } from './vehicle-section-icons';
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

function initialValues(vehicle?: Vehicle): VehicleFormValues {
  return {
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: vehicle ? String(vehicle.year) : '',
    fuel: vehicle?.fuel ?? 'NAFTA',
    plate: vehicle?.plate ?? '',
    mileage: vehicle ? String(vehicle.mileage) : '',
    nickname: vehicle?.nickname ?? '',
    engineOilType: vehicle?.engineOilType ?? '',
    engineOilLiters:
      vehicle?.engineOilLiters === null ? '' : String(vehicle?.engineOilLiters ?? ''),
    gearboxOilType: vehicle?.gearboxOilType ?? '',
    gearboxOilLiters:
      vehicle?.gearboxOilLiters === null ? '' : String(vehicle?.gearboxOilLiters ?? ''),
    transmission: vehicle?.transmission ?? '',
    frontTireSize: vehicle?.frontTireSize ?? '',
    frontTirePressurePsi:
      vehicle?.frontTirePressurePsi === null ? '' : String(vehicle?.frontTirePressurePsi ?? ''),
    rearTireSize: vehicle?.rearTireSize ?? '',
    rearTirePressurePsi:
      vehicle?.rearTirePressurePsi === null ? '' : String(vehicle?.rearTirePressurePsi ?? ''),
    highBeam: vehicle?.highBeam ?? '',
    lowBeam: vehicle?.lowBeam ?? '',
    fogLight: vehicle?.fogLight ?? '',
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
  const formId = useId();
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
      className="lg:max-w-2xl"
      description="Completá la ficha con los datos que tengas disponibles"
      footer={
        <Button className="w-full gap-2" disabled={isPending} form={formId} type="submit">
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
      <form
        aria-busy={isPending}
        className="space-y-4"
        id={formId}
        noValidate
        onSubmit={handleSubmit}
      >
        <FormSection iconSrc={VEHICLE_SECTION_ICONS.identification} title="Identificación">
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
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
        </FormSection>

        <FormSection iconSrc={VEHICLE_SECTION_ICONS.lubricants} title="Lubricantes">
          <div className="space-y-5">
            <div>
              <Text color="muted" variant="caption-strong">
                Aceite de motor
              </Text>
              <div className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(6rem,1fr)] gap-3">
                <FormField error={errors.engineOilType} id="vehicle-engine-oil-type" label="Tipo">
                  <Input
                    aria-describedby={
                      errors.engineOilType ? 'vehicle-engine-oil-type-error' : undefined
                    }
                    aria-invalid={Boolean(errors.engineOilType)}
                    id="vehicle-engine-oil-type"
                    placeholder="5W-30 sintético"
                    value={values.engineOilType}
                    onChange={(event) => updateField('engineOilType', event.target.value)}
                  />
                </FormField>
                <FormField
                  error={errors.engineOilLiters}
                  id="vehicle-engine-oil-liters"
                  label="Cantidad"
                >
                  <UnitInput
                    aria-describedby={
                      errors.engineOilLiters ? 'vehicle-engine-oil-liters-error' : undefined
                    }
                    aria-invalid={Boolean(errors.engineOilLiters)}
                    id="vehicle-engine-oil-liters"
                    inputMode="decimal"
                    placeholder="4.2"
                    unit="L"
                    value={values.engineOilLiters}
                    onChange={(event) => updateField('engineOilLiters', event.target.value)}
                  />
                </FormField>
              </div>
            </div>

            <div>
              <Text color="muted" variant="caption-strong">
                Aceite de caja
              </Text>
              <div className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(6rem,1fr)] gap-3">
                <FormField error={errors.gearboxOilType} id="vehicle-gearbox-oil-type" label="Tipo">
                  <Input
                    aria-describedby={
                      errors.gearboxOilType ? 'vehicle-gearbox-oil-type-error' : undefined
                    }
                    aria-invalid={Boolean(errors.gearboxOilType)}
                    id="vehicle-gearbox-oil-type"
                    placeholder="ATF DW-1"
                    value={values.gearboxOilType}
                    onChange={(event) => updateField('gearboxOilType', event.target.value)}
                  />
                </FormField>
                <FormField
                  error={errors.gearboxOilLiters}
                  id="vehicle-gearbox-oil-liters"
                  label="Cantidad"
                >
                  <UnitInput
                    aria-describedby={
                      errors.gearboxOilLiters ? 'vehicle-gearbox-oil-liters-error' : undefined
                    }
                    aria-invalid={Boolean(errors.gearboxOilLiters)}
                    id="vehicle-gearbox-oil-liters"
                    inputMode="decimal"
                    placeholder="3.1"
                    unit="L"
                    value={values.gearboxOilLiters}
                    onChange={(event) => updateField('gearboxOilLiters', event.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection iconSrc={VEHICLE_SECTION_ICONS.transmission} title="Transmisión">
          <FormField error={errors.transmission} id="vehicle-transmission" label="Tipo">
            <Select
              aria-describedby={errors.transmission ? 'vehicle-transmission-error' : undefined}
              aria-invalid={Boolean(errors.transmission)}
              id="vehicle-transmission"
              value={values.transmission}
              onChange={(event) =>
                updateField('transmission', event.target.value as TransmissionType | '')
              }
            >
              <option value="">Seleccioná una opción</option>
              {TRANSMISSION_TYPES.map((transmission) => (
                <option key={transmission} value={transmission}>
                  {TRANSMISSION_LABELS[transmission]}
                </option>
              ))}
            </Select>
          </FormField>
        </FormSection>

        <FormSection iconSrc={VEHICLE_SECTION_ICONS.tires} title="Neumáticos">
          <div className="space-y-5">
            <div>
              <Text color="muted" variant="caption-strong">
                Delanteros
              </Text>
              <div className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(6rem,1fr)] gap-3">
                <FormField error={errors.frontTireSize} id="vehicle-front-tire-size" label="Medida">
                  <Input
                    aria-describedby={
                      errors.frontTireSize ? 'vehicle-front-tire-size-error' : undefined
                    }
                    aria-invalid={Boolean(errors.frontTireSize)}
                    id="vehicle-front-tire-size"
                    placeholder="215/50 R17"
                    value={values.frontTireSize}
                    onChange={(event) => updateField('frontTireSize', event.target.value)}
                  />
                </FormField>
                <FormField
                  error={errors.frontTirePressurePsi}
                  id="vehicle-front-tire-pressure"
                  label="Presión"
                >
                  <UnitInput
                    aria-describedby={
                      errors.frontTirePressurePsi ? 'vehicle-front-tire-pressure-error' : undefined
                    }
                    aria-invalid={Boolean(errors.frontTirePressurePsi)}
                    id="vehicle-front-tire-pressure"
                    inputMode="numeric"
                    placeholder="32"
                    unit="PSI"
                    value={values.frontTirePressurePsi}
                    onChange={(event) => updateField('frontTirePressurePsi', event.target.value)}
                  />
                </FormField>
              </div>
            </div>

            <div>
              <Text color="muted" variant="caption-strong">
                Traseros
              </Text>
              <div className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(6rem,1fr)] gap-3">
                <FormField error={errors.rearTireSize} id="vehicle-rear-tire-size" label="Medida">
                  <Input
                    aria-describedby={
                      errors.rearTireSize ? 'vehicle-rear-tire-size-error' : undefined
                    }
                    aria-invalid={Boolean(errors.rearTireSize)}
                    id="vehicle-rear-tire-size"
                    placeholder="215/50 R17"
                    value={values.rearTireSize}
                    onChange={(event) => updateField('rearTireSize', event.target.value)}
                  />
                </FormField>
                <FormField
                  error={errors.rearTirePressurePsi}
                  id="vehicle-rear-tire-pressure"
                  label="Presión"
                >
                  <UnitInput
                    aria-describedby={
                      errors.rearTirePressurePsi ? 'vehicle-rear-tire-pressure-error' : undefined
                    }
                    aria-invalid={Boolean(errors.rearTirePressurePsi)}
                    id="vehicle-rear-tire-pressure"
                    inputMode="numeric"
                    placeholder="30"
                    unit="PSI"
                    value={values.rearTirePressurePsi}
                    onChange={(event) => updateField('rearTirePressurePsi', event.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection iconSrc={VEHICLE_SECTION_ICONS.lights} title="Luces">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField error={errors.highBeam} id="vehicle-high-beam" label="Altas">
              <Input
                aria-describedby={errors.highBeam ? 'vehicle-high-beam-error' : undefined}
                aria-invalid={Boolean(errors.highBeam)}
                id="vehicle-high-beam"
                placeholder="H11"
                value={values.highBeam}
                onChange={(event) => updateField('highBeam', event.target.value)}
              />
            </FormField>
            <FormField error={errors.lowBeam} id="vehicle-low-beam" label="Bajas">
              <Input
                aria-describedby={errors.lowBeam ? 'vehicle-low-beam-error' : undefined}
                aria-invalid={Boolean(errors.lowBeam)}
                id="vehicle-low-beam"
                placeholder="H7"
                value={values.lowBeam}
                onChange={(event) => updateField('lowBeam', event.target.value)}
              />
            </FormField>
            <FormField
              className="col-span-2 sm:col-span-1"
              error={errors.fogLight}
              id="vehicle-fog-light"
              label="Antinieblas"
            >
              <Input
                aria-describedby={errors.fogLight ? 'vehicle-fog-light-error' : undefined}
                aria-invalid={Boolean(errors.fogLight)}
                id="vehicle-fog-light"
                placeholder="H8"
                value={values.fogLight}
                onChange={(event) => updateField('fogLight', event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>
      </form>
    </BottomSheet>
  );
}

type FormSectionProps = {
  children: ReactNode;
  iconSrc: string;
  title: string;
};

function FormSection({ children, iconSrc, title }: FormSectionProps) {
  return (
    <div className="rounded-[18px] border border-border bg-neutral-50 p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-[11px] bg-card shadow-sm">
          <Icon size="xl" src={iconSrc} />
        </div>
        <Text variant="card-title">{title}</Text>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

type UnitInputProps = Omit<ComponentProps<typeof Input>, 'className'> & {
  unit: string;
};

function UnitInput({ unit, ...props }: UnitInputProps) {
  return (
    <div className="relative">
      <Input className="pr-12" {...props} />
      <Text
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
        color="subtle"
        variant="caption-strong"
      >
        {unit}
      </Text>
    </div>
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
