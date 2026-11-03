import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { useDeleteWishlistItem } from './queries';
import type { WishlistItem } from './types';

type DeleteWishlistItemConfirmSheetProps = {
  item: WishlistItem;
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

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as ApiError).status === 404;
}

export function DeleteWishlistItemConfirmSheet({
  item,
  open,
  onOpenChange,
}: DeleteWishlistItemConfirmSheetProps) {
  const deleteItem = useDeleteWishlistItem();

  async function handleDelete() {
    try {
      await deleteItem.mutateAsync({ vehicleId: item.vehicleId, id: item.id });
    } catch (error) {
      // Already gone (deleted elsewhere): same outcome for the user; onSettled refreshes the list.
      if (!isNotFound(error)) {
        toast.error(isApiError(error) ? error.message : 'No pudimos eliminar el deseo');
        return;
      }
    }
    onOpenChange(false);
    toast.success('Deseo eliminado');
  }

  return (
    <BottomSheet
      description={`Vas a eliminar «${item.name}». No se puede deshacer.`}
      dismissible={!deleteItem.isPending}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            className="w-full gap-2"
            disabled={deleteItem.isPending}
            variant="destructive"
            onClick={() => void handleDelete()}
          >
            {deleteItem.isPending ? (
              <Icon className="animate-spin" color="danger" name="Loader2" />
            ) : null}
            <Text color="danger" variant="label">
              {deleteItem.isPending ? 'Eliminando…' : 'Eliminar'}
            </Text>
          </Button>
          <Button
            className="w-full"
            disabled={deleteItem.isPending}
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            <Text variant="label">Cancelar</Text>
          </Button>
        </div>
      }
      open={open}
      onOpenChange={onOpenChange}
      title="Eliminar deseo"
    >
      {null}
    </BottomSheet>
  );
}
