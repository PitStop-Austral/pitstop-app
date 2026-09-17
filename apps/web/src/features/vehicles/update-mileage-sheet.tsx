import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { useUpdateVehicleMileage } from './queries';
import { getMileageUpdateSchema } from './vehicle-form-schema';
import type { Vehicle } from './types';

type UpdateMileageSheetProps = {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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

export function UpdateMileageSheet({ vehicle, open, onOpenChange }: UpdateMileageSheetProps) {
  const formId = useId();
  const [mileage, setMileage] = useState(() => String(vehicle.mileage));
  const [error, setError] = useState<string>();
  const updateMileage = useUpdateVehicleMileage();
  const isPending = updateMileage.isPending;
  const vehicleName = `${vehicle.brand} ${vehicle.model}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = getMileageUpdateSchema(vehicle.mileage).safeParse({ mileage });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Ingresá un kilometraje válido');
      return;
    }

    setError(undefined);

    try {
      await updateMileage.mutateAsync({ id: vehicle.id, mileage: result.data.mileage });
      onOpenChange(false);
      toast.success('Kilometraje actualizado');
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 400) {
        setError(requestError.message);
        return;
      }

      toast.error(
        isApiError(requestError) ? requestError.message : 'No pudimos actualizar el kilometraje',
      );
    }
  }

  return (
    <BottomSheet
      description={`${vehicleName} · actualmente ${formatNumber(vehicle.mileage)} km`}
      dismissible={!isPending}
      footer={
        <Button className="w-full gap-2" disabled={isPending} form={formId} type="submit">
          {isPending ? <Icon className="animate-spin" color="on-primary" name="Loader2" /> : null}
          <Text color="on-primary" variant="label">
            {isPending ? 'Actualizando...' : 'Actualizar'}
          </Text>
        </Button>
      }
      open={open}
      onOpenChange={onOpenChange}
      title="Actualizar kilometraje"
    >
      <form aria-busy={isPending} id={formId} noValidate onSubmit={handleSubmit}>
        <Text
          as="label"
          className="mb-2 block"
          color="emphasis"
          htmlFor="vehicle-mileage"
          variant="label"
        >
          Kilometraje actual
        </Text>
        <Input
          aria-describedby={error ? 'vehicle-mileage-error' : undefined}
          aria-invalid={Boolean(error)}
          autoFocus
          id="vehicle-mileage"
          inputMode="numeric"
          value={mileage}
          onChange={(event) => {
            setMileage(event.target.value);
            setError(undefined);
          }}
        />
        {error ? (
          <Text
            className="mt-1.5 block"
            color="danger"
            id="vehicle-mileage-error"
            variant="caption"
          >
            {error}
          </Text>
        ) : null}
      </form>
    </BottomSheet>
  );
}
