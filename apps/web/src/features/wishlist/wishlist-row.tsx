import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { setPurchasedMutationKey, useSetWishlistItemPurchased } from './queries';
import { PRIORITY_STYLES } from './types';
import type { WishlistItem } from './types';

type WishlistRowProps = {
  item: WishlistItem;
  focusToggle: boolean;
  onToggle: () => void;
  onDelete: () => void;
};

export function WishlistRow({ item, focusToggle, onToggle, onDelete }: WishlistRowProps) {
  const setPurchased = useSetWishlistItemPurchased(item.vehicleId, item.id);
  // Read from the mutation cache, not this hook's own state: toggling moves the row to the other
  // list, so it remounts with a fresh useMutation while the first PATCH is still in flight.
  const isToggling =
    useIsMutating({ mutationKey: setPurchasedMutationKey(item.vehicleId, item.id) }) > 0;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const priority = PRIORITY_STYLES[item.priority];

  // The remounted row takes the focus back so keyboard users stay on the item they toggled.
  useEffect(() => {
    if (focusToggle) toggleRef.current?.focus();
  }, [focusToggle]);

  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition-shadow hover:shadow-sm sm:px-3">
      <button
        aria-disabled={isToggling}
        aria-label={`${item.purchased ? 'Marcar como pendiente' : 'Marcar como comprado'}: ${item.name}`}
        aria-pressed={item.purchased}
        className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        ref={toggleRef}
        type="button"
        onClick={() => {
          // aria-disabled instead of disabled: a disabled button can't keep the focus. One PATCH
          // per item at a time, so a quick double tap can't race true/false requests.
          if (isToggling) return;
          onToggle();
          setPurchased.mutate(!item.purchased);
        }}
      >
        <div
          className={cn(
            'grid size-5 place-items-center rounded-full border-2',
            item.purchased ? 'border-success bg-success' : 'border-neutral-300 bg-card',
          )}
        >
          {item.purchased ? <Icon color="inverse" name="Check" size={14} strokeWidth={3} /> : null}
        </div>
      </button>

      <div className="min-w-0 flex-1">
        <Text
          className={cn('break-words', item.purchased && 'line-through')}
          color={item.purchased ? 'muted' : 'default'}
          variant="body-strong"
        >
          {item.name}
        </Text>
        {item.note ? (
          <Text as="p" className="truncate" color="muted" title={item.note} variant="caption">
            {item.note}
          </Text>
        ) : null}
        <div className="mt-0.5 flex flex-wrap gap-x-3">
          <div className="flex items-center gap-1.5">
            <div className={cn('size-1.5 rounded-full', priority.dotClassName)} />
            <Text color={item.purchased ? 'muted' : priority.textColor} variant="caption-strong">
              {priority.label}
            </Text>
          </div>
          {item.estimatedPrice !== null ? (
            <Text className="tabular-nums" color="emphasis" variant="caption-strong">
              {formatCurrency(item.estimatedPrice)}
            </Text>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Opciones de ${item.name}`}
          className="grid size-11 shrink-0 place-items-center rounded-full outline-none transition hover:bg-neutral-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Icon color="muted" name="EllipsisVertical" size="md" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onDelete}>
            <Icon color="danger" name="Trash2" size="sm" />
            <Text color="danger" variant="label">
              Eliminar
            </Text>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
