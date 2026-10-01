import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { useDeleteSchedule } from './queries';
import type { Schedule } from './types';

type DeleteScheduleConfirmSheetProps = {
  schedule: Schedule;
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

export function DeleteScheduleConfirmSheet({
  schedule,
  open,
  onOpenChange,
}: DeleteScheduleConfirmSheetProps) {
  const deleteSchedule = useDeleteSchedule();

  async function handleDelete() {
    try {
      await deleteSchedule.mutateAsync({ vehicleId: schedule.vehicleId, id: schedule.id });
      onOpenChange(false);
      toast.success('Frecuencia eliminada');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'No pudimos eliminar la frecuencia');
    }
  }

  return (
    <BottomSheet
      description="Se quita de las recomendaciones del vehículo"
      dismissible={!deleteSchedule.isPending}
      footer={
        <Button
          className="w-full gap-2"
          disabled={deleteSchedule.isPending}
          variant="destructive"
          onClick={() => void handleDelete()}
        >
          {deleteSchedule.isPending ? (
            <Icon className="animate-spin" color="danger" name="Loader2" size="sm" />
          ) : null}
          <Text color="danger" variant="label">
            {deleteSchedule.isPending ? 'Eliminando...' : 'Eliminar definitivamente'}
          </Text>
        </Button>
      }
      open={open}
      title="Eliminar frecuencia"
      onOpenChange={onOpenChange}
    >
      <div className="flex gap-3 rounded-[16px] bg-red-50 p-4" role="alert">
        <div className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-primary">
          <Icon color="on-primary" name="AlertTriangle" size="md" />
        </div>
        <Text color="emphasis" variant="body">
          Vas a eliminar la frecuencia de{' '}
          <Text as="strong" variant="body-strong">
            {schedule.type}
          </Text>
          . No se puede deshacer.
        </Text>
      </div>
    </BottomSheet>
  );
}
