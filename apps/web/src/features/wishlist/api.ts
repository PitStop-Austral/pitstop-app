import { apiClient } from '@/lib/api-client';
import type { WishlistItem, WishlistItemInput } from './types';

export async function getWishlist(
  vehicleId: string,
  signal?: AbortSignal,
): Promise<WishlistItem[]> {
  const response = await apiClient.get<WishlistItem[]>(`/vehicles/${vehicleId}/wishlist`, {
    signal,
  });
  return response.data;
}

export async function createWishlistItem(
  vehicleId: string,
  input: WishlistItemInput,
): Promise<WishlistItem> {
  const response = await apiClient.post<WishlistItem>(`/vehicles/${vehicleId}/wishlist`, input);
  return response.data;
}

export async function setWishlistItemPurchased(
  vehicleId: string,
  id: string,
  purchased: boolean,
): Promise<WishlistItem> {
  const response = await apiClient.patch<WishlistItem>(
    `/vehicles/${vehicleId}/wishlist/${id}/purchased`,
    { purchased },
  );
  return response.data;
}

export async function deleteWishlistItem(vehicleId: string, id: string): Promise<void> {
  await apiClient.delete(`/vehicles/${vehicleId}/wishlist/${id}`);
}
