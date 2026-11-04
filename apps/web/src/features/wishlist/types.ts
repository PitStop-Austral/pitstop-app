import type { TextColor } from '@/components/ui/text';

export const WISHLIST_PRIORITIES = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number];

export type WishlistItem = {
  id: string;
  vehicleId: string;
  name: string;
  estimatedPrice: number | null;
  priority: WishlistPriority;
  note: string | null;
  purchased: boolean;
  purchasedAt: string | null;
  createdAt: string;
};

export type WishlistItemInput = {
  name: string;
  estimatedPrice?: number;
  priority: WishlistPriority;
  note?: string;
};

export const PRIORITY_STYLES: Record<
  WishlistPriority,
  { label: string; dotClassName: string; textColor: TextColor }
> = {
  ALTA: { label: 'Alta', dotClassName: 'bg-primary', textColor: 'primary' },
  MEDIA: { label: 'Media', dotClassName: 'bg-warning', textColor: 'warning' },
  BAJA: { label: 'Baja', dotClassName: 'bg-neutral-500', textColor: 'muted' },
};
