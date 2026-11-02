import type { WishlistItemView } from './wishlist.repository';

export type WishlistItemResponse = Omit<WishlistItemView, 'estimatedPrice'> & {
  estimatedPrice: number | null;
};

export function toWishlistItemResponse(item: WishlistItemView): WishlistItemResponse {
  return { ...item, estimatedPrice: item.estimatedPrice?.toNumber() ?? null };
}
