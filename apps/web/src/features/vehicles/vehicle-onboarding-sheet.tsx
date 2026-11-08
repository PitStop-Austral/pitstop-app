import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import type { FormEvent } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { useCreateVehicle } from './queries';
import { FUEL_LABELS, FUEL_TYPES } from './types';
import type { FuelType } from './types';
import {
  getVehicleFormErrors,
  vehicleFormSchema,
  type VehicleFormErrors,
  type VehicleFormValues,
} from './vehicle-form-schema';
import { initialValues } from './vehicle-form-sheet';

type VehicleOnboardingSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = 0 | 1 | 2;
type OnboardingField = 'brand' | 'model' | 'year' | 'fuel' | 'plate' | 'mileage';

const STEP_FIELDS: Record<Step, readonly OnboardingField[]> = {
  0: ['brand', 'model'],
  1: ['year', 'fuel'],
  2: ['plate', 'mileage'],
};

const STEP_FIELD_IDS: Record<OnboardingField, string> = {
  brand: 'vehicle-onboarding-brand',
  model: 'vehicle-onboarding-model',
  year: 'vehicle-onboarding-year',
  fuel: 'vehicle-onboarding-fuel',
  plate: 'vehicle-onboarding-plate',
  mileage: 'vehicle-onboarding-mileage',
};

const STEP_COPY = [
  {
    title: '¿Qué vehículo tenés?',
    description: 'Marca y modelo, como figuran en la cédula.',
  },
  {
    title: '¿De qué año es?',
    description: 'El año del modelo y el combustible que usa.',
  },
  {
    title: 'Patente y kilometraje',
    description: 'Con el kilometraje actual te avisamos cuándo toca cada servicio.',
  },
] as const;

const STEP_SCHEMAS = [
  vehicleFormSchema.pick({ brand: true, model: true }),
  vehicleFormSchema.pick({ year: true, fuel: true }),
  vehicleFormSchema.pick({ plate: true, mileage: true }),
] as const;

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

export function VehicleOnboardingSheet({ open, onOpenChange }: VehicleOnboardingSheetProps) {
  const formId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>(0);
  const [values, setValues] = useState<VehicleFormValues>(initialValues);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const createVehicle = useCreateVehicle();
  const submittingRef = useRef(false);
  const isPending = createVehicle.isPending;
  const copy = STEP_COPY[step];

  useEffect(() => {
    document.getElementById(STEP_FIELD_IDS[STEP_FIELDS[step][0]])?.focus();
  }, [step]);

  function updateField<Field extends OnboardingField>(
    field: Field,
    value: VehicleFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function focusFirstError(nextErrors: VehicleFormErrors) {
    const field = STEP_FIELDS[step].find((current) => nextErrors[current]);
    if (field) document.getElementById(STEP_FIELD_IDS[field])?.focus();
  }

  function validateCurrentStep(): boolean {
    const result = STEP_SCHEMAS[step].safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }

    const nextErrors = getVehicleFormErrors(result.error);
    setErrors(nextErrors);
    focusFirstError(nextErrors);
    return false;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || submittingRef.current) return;

    if (step === 0) {
      if (validateCurrentStep()) setStep(1);
      return;
    }

    if (step === 1) {
      if (validateCurrentStep()) setStep(2);
      return;
    }

    const result = vehicleFormSchema.safeParse(values);
    if (!result.success) {
      const nextErrors = getVehicleFormErrors(result.error);
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setErrors({});
    submittingRef.current = true;

    try {
      await createVehicle.mutateAsync(result.data);
      toast.success('Vehículo guardado');
      onOpenChange(false);

      if (location.pathname !== '/garage') {
        void navigate({ to: '/garage', search: { tab: 'info' } });
      }
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setErrors({ plate: error.message });
        return;
      }

      toast.error(isApiError(error) ? error.message : 'No pudimos guardar el vehículo');
    } finally {
      submittingRef.current = false;
    }
  }

  function handleBack() {
    if (step === 1) setStep(0);
    if (step === 2) setStep(1);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isPending) onOpenChange(false);
  }

  return (
    <BottomSheet
      description="Son 3 pasos cortos. El resto de la ficha lo completás cuando quieras."
      dismissible={!isPending}
      footer={
        <div className="grid grid-cols-2 gap-3">
          {step === 0 ? (
            <Button disabled={isPending} variant="ghost" onClick={() => handleOpenChange(false)}>
              <Text variant="label">Ahora no</Text>
            </Button>
          ) : (
            <Button disabled={isPending} variant="secondary" onClick={handleBack}>
              <Icon name="ArrowLeft" size="sm" />
              <Text variant="label">Atrás</Text>
            </Button>
          )}
          <Button className="gap-2" disabled={isPending} form={formId} type="submit">
            {isPending ? <Icon className="animate-spin" color="on-primary" name="Loader2" /> : null}
            <Text color="on-primary" variant="label">
              {isPending ? 'Guardando...' : step === 2 ? 'Guardar vehículo' : 'Siguiente'}
            </Text>
            {!isPending && step !== 2 ? (
              <Icon color="on-primary" name="ArrowRight" size="sm" />
            ) : null}
          </Button>
        </div>
      }
      open={open}
      title="Sumá tu primer vehículo"
      onOpenChange={handleOpenChange}
    >
      <form aria-busy={isPending} id={formId} noValidate onSubmit={handleSubmit}>
        <Text aria-live="polite" className="sr-only" variant="caption">
          Paso {step + 1} de 3: {copy.title}
        </Text>
        <Text color="muted" variant="caption-strong">
          Paso {step + 1} de 3
        </Text>
        <div aria-hidden className="mt-2 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((progressStep) => (
            <div
              className={
                progressStep <= step
                  ? 'h-1.5 rounded-full bg-primary'
                  : 'h-1.5 rounded-full bg-neutral-200'
              }
              key={progressStep}
            />
          ))}
        </div>

        <Text as="h3" className="mt-5" variant="subheading">
          {copy.title}
        </Text>
        <Text className="mt-1" color="muted" variant="body">
          {copy.description}
        </Text>

        <div className="mt-5 space-y-4">
          {step === 0 ? (
            <>
              <FormField error={errors.brand} id={STEP_FIELD_IDS.brand} label="Marca">
                <Input
                  aria-describedby={errors.brand ? `${STEP_FIELD_IDS.brand}-error` : undefined}
                  aria-invalid={Boolean(errors.brand)}
                  autoComplete="organization"
                  id={STEP_FIELD_IDS.brand}
                  placeholder="Honda"
                  value={values.brand}
                  onChange={(event) => updateField('brand', event.target.value)}
                />
              </FormField>
              <FormField error={errors.model} id={STEP_FIELD_IDS.model} label="Modelo">
                <Input
                  aria-describedby={errors.model ? `${STEP_FIELD_IDS.model}-error` : undefined}
                  aria-invalid={Boolean(errors.model)}
                  id={STEP_FIELD_IDS.model}
                  placeholder="Civic"
                  value={values.model}
                  onChange={(event) => updateField('model', event.target.value)}
                />
              </FormField>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <FormField error={errors.year} id={STEP_FIELD_IDS.year} label="Año">
                <Input
                  aria-describedby={errors.year ? `${STEP_FIELD_IDS.year}-error` : undefined}
                  aria-invalid={Boolean(errors.year)}
                  id={STEP_FIELD_IDS.year}
                  inputMode="numeric"
                  max={new Date().getFullYear() + 1}
                  min={1900}
                  placeholder="2021"
                  type="number"
                  value={values.year}
                  onChange={(event) => updateField('year', event.target.value)}
                />
              </FormField>
              <FormField error={errors.fuel} id={STEP_FIELD_IDS.fuel} label="Combustible">
                <Select
                  value={values.fuel}
                  onValueChange={(value) => updateField('fuel', value as FuelType)}
                >
                  <SelectTrigger
                    aria-describedby={errors.fuel ? `${STEP_FIELD_IDS.fuel}-error` : undefined}
                    aria-invalid={Boolean(errors.fuel)}
                    id={STEP_FIELD_IDS.fuel}
                  >
                    <SelectValue>
                      {(value: FuelType) => <Text variant="label">{FUEL_LABELS[value]}</Text>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_TYPES.map((fuel) => (
                      <SelectItem key={fuel} value={fuel}>
                        <Text variant="label">{FUEL_LABELS[fuel]}</Text>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <FormField error={errors.plate} id={STEP_FIELD_IDS.plate} label="Patente">
                <Input
                  aria-describedby={errors.plate ? `${STEP_FIELD_IDS.plate}-error` : undefined}
                  aria-invalid={Boolean(errors.plate)}
                  autoCapitalize="characters"
                  id={STEP_FIELD_IDS.plate}
                  placeholder="AF 812 KM"
                  value={values.plate}
                  onChange={(event) => updateField('plate', event.target.value.toUpperCase())}
                />
              </FormField>
              <FormField
                error={errors.mileage}
                id={STEP_FIELD_IDS.mileage}
                label="Kilometraje actual"
              >
                <div className="relative">
                  <Input
                    aria-describedby={
                      errors.mileage ? `${STEP_FIELD_IDS.mileage}-error` : undefined
                    }
                    aria-invalid={Boolean(errors.mileage)}
                    className="pr-12"
                    id={STEP_FIELD_IDS.mileage}
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
            </>
          ) : null}
        </div>
      </form>
    </BottomSheet>
  );
}
