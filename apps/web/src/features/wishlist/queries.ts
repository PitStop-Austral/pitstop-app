import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/sonner';
import {
  createWishlistItem,
  deleteWishlistItem,
  getWishlist,
  setWishlistItemPurchased,
} from './api';
import type { WishlistItem, WishlistItemInput } from './types';

export const wishlistQueryKey = (vehicleId: string) => ['vehicles', vehicleId, 'wishlist'] as const;

// Per-item key: `useIsMutating` on it survives the row remounting when it changes block, and the
// vehicle prefix lets the invalidation below count only that vehicle's toggles.
export const setPurchasedMutationKey = (vehicleId: string, id?: string) =>
  id
    ? (['wishlist', vehicleId, 'set-purchased', id] as const)
    : (['wishlist', vehicleId, 'set-purchased'] as const);

export function useWishlist(vehicleId?: string) {
  return useQuery({
    queryKey: wishlistQueryKey(vehicleId ?? ''),
    queryFn: ({ signal }) => getWishlist(vehicleId ?? '', signal),
    enabled: Boolean(vehicleId),
  });
}

export function useCreateWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, input }: { vehicleId: string; input: WishlistItemInput }) =>
      createWishlistItem(vehicleId, input),
    onSuccess: async (_item, { vehicleId }) => {
      await queryClient.invalidateQueries({ queryKey: wishlistQueryKey(vehicleId), exact: true });
    },
  });
}

export function useSetWishlistItemPurchased(vehicleId: string, id: string) {
  const queryClient = useQueryClient();
  const queryKey = wishlistQueryKey(vehicleId);

  // Rewrites only this item, so other rows' optimistic state is left untouched.
  function patchItem(changes: Pick<WishlistItem, 'purchased' | 'purchasedAt'>) {
    queryClient.setQueryData<WishlistItem[]>(queryKey, (current) =>
      current?.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  return useMutation({
    mutationKey: setPurchasedMutationKey(vehicleId, id),
    mutationFn: (purchased: boolean) => setWishlistItemPurchased(vehicleId, id, purchased),
    onMutate: async (purchased) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient
        .getQueryData<WishlistItem[]>(queryKey)
        ?.find((item) => item.id === id);
      patchItem({ purchased, purchasedAt: purchased ? new Date().toISOString() : null });
      return previous
        ? { purchased: previous.purchased, purchasedAt: previous.purchasedAt }
        : undefined;
    },
    onError: (_error, _purchased, previous) => {
      if (previous) patchItem(previous);
      toast.error('No pudimos actualizar el deseo. Probá de nuevo.');
    },
    onSettled: async () => {
      // Only the last in-flight toggle of this vehicle refetches, so the response for one row
      // doesn't overwrite another row's optimistic state while its PATCH is still pending.
      if (queryClient.isMutating({ mutationKey: setPurchasedMutationKey(vehicleId) }) === 1) {
        await queryClient.invalidateQueries({ queryKey, exact: true });
      }
    },
  });
}

export function useDeleteWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, id }: { vehicleId: string; id: string }) =>
      deleteWishlistItem(vehicleId, id),
    onSuccess: (_data, { vehicleId, id }) => {
      queryClient.setQueryData<WishlistItem[]>(wishlistQueryKey(vehicleId), (current) =>
        current?.filter((item) => item.id !== id),
      );
    },
    // Settled, not success: a 404 for an item that is already gone still refreshes the list.
    onSettled: async (_data, _error, { vehicleId }) => {
      await queryClient.invalidateQueries({ queryKey: wishlistQueryKey(vehicleId), exact: true });
    },
  });
}
