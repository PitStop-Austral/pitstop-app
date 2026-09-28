import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { useDeleteMaintenance } from './queries';
import type { Maintenance } from './types';

type DeleteMaintenanceConfirmSheetProps = {
  maintenance: Maintenance;
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

export function DeleteMaintenanceConfirmSheet({
  maintenance,
  open,
  onOpenChange,
}: DeleteMaintenanceConfirmSheetProps) {
  const deleteMaintenance = useDeleteMaintenance();

  async function handleDelete() {
    try {
      await deleteMaintenance.mutateAsync({
        vehicleId: maintenance.vehicleId,
        id: maintenance.id,
      });
      onOpenChange(false);
      toast.success('Servicio eliminado');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'No pudimos eliminar el servicio');
    }
  }

  return (
    <BottomSheet
      description="Se quita del historial del vehículo"
      dismissible={!deleteMaintenance.isPending}
      footer={
        <Button
          className="w-full gap-2"
          disabled={deleteMaintenance.isPending}
          variant="destructive"
          onClick={() => void handleDelete()}
        >
          {deleteMaintenance.isPending ? (
            <Icon className="animate-spin" color="danger" name="Loader2" />
          ) : null}
          <Text color="danger" variant="label">
            {deleteMaintenance.isPending ? 'Eliminando...' : 'Eliminar definitivamente'}
          </Text>
        </Button>
      }
      open={open}
      onOpenChange={onOpenChange}
      title="Eliminar servicio"
    >
      <div className="flex gap-3 rounded-[16px] bg-red-50 p-4" role="alert">
        <div className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-primary">
          <Icon color="on-primary" name="AlertTriangle" size="md" />
        </div>
        <Text color="emphasis" variant="body">
          Vas a eliminar el registro de{' '}
          <Text as="strong" variant="body-strong">
            {maintenance.type}
          </Text>{' '}
          del {formatDate(maintenance.date)}. No se puede deshacer.
        </Text>
      </div>
    </BottomSheet>
  );
}
