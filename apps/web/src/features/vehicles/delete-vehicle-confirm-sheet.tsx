import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { useDeleteVehicle } from './queries';
import type { Vehicle } from './types';

type DeleteVehicleConfirmSheetProps = {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export function DeleteVehicleConfirmSheet({
  vehicle,
  open,
  onOpenChange,
}: DeleteVehicleConfirmSheetProps) {
  const deleteVehicle = useDeleteVehicle();
  const vehicleName = `${vehicle.brand} ${vehicle.model}`;

  async function handleDelete() {
    try {
      await deleteVehicle.mutateAsync(vehicle.id);
      onOpenChange(false);
      toast.success('Vehículo eliminado');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'No pudimos eliminar el vehículo');
    }
  }

  return (
    <BottomSheet
      description="Esta acción también elimina su historial, sus frecuencias y sus deseos"
      dismissible={!deleteVehicle.isPending}
      footer={
        <Button
          className="w-full gap-2"
          disabled={deleteVehicle.isPending}
          variant="destructive"
          onClick={() => void handleDelete()}
        >
          {deleteVehicle.isPending ? (
            <Icon className="animate-spin" color="danger" name="Loader2" />
          ) : null}
          <Text color="danger" variant="label">
            {deleteVehicle.isPending ? 'Eliminando...' : 'Eliminar definitivamente'}
          </Text>
        </Button>
      }
      open={open}
      onOpenChange={onOpenChange}
      title="Eliminar vehículo"
    >
      <div className="flex gap-3 rounded-[16px] bg-red-50 p-4" role="alert">
        <div className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-primary">
          <Icon color="on-primary" name="AlertTriangle" size="md" />
        </div>
        <Text color="emphasis" variant="body">
          Vas a eliminar el{' '}
          <Text as="strong" variant="body-strong">
            {vehicleName}
          </Text>{' '}
          y se perderán su historial, sus frecuencias y sus deseos. No se puede deshacer.
        </Text>
      </div>
    </BottomSheet>
  );
}
