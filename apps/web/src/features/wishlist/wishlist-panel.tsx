import { useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DeleteWishlistItemConfirmSheet } from './delete-wishlist-item-confirm-sheet';
import { useWishlist } from './queries';
import type { WishlistItem } from './types';
import { WishlistFormSheet } from './wishlist-form-sheet';
import { WishlistRow } from './wishlist-row';

export function WishlistPanel({ vehicleId }: { vehicleId: string }) {
  const wishlistQuery = useWishlist(vehicleId);
  const [formOpen, setFormOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WishlistItem | null>(null);
  const [lastToggledId, setLastToggledId] = useState<string | null>(null);

  const addButton = (
    <Button className="min-h-11 gap-2" onClick={() => setFormOpen(true)}>
      <Icon color="on-primary" name="Plus" size="sm" />
      <Text color="on-primary" variant="label">
        Agregar deseo
      </Text>
    </Button>
  );

  function renderContent() {
    if (wishlistQuery.isPending) {
      return (
        <div aria-busy className="mt-4 space-y-2.5">
          {[0, 1, 2].map((index) => (
            <div className="h-[72px] animate-pulse rounded-lg bg-neutral-100" key={index} />
          ))}
        </div>
      );
    }

    if (wishlistQuery.isError && !wishlistQuery.data) {
      return (
        <div className="mt-4">
          <EmptyState
            action={
              <Button variant="secondary" onClick={() => void wishlistQuery.refetch()}>
                <Text variant="label">Volver a intentar</Text>
              </Button>
            }
            description="Revisá tu conexión y volvé a intentarlo."
            icon="TriangleAlert"
            title="No pudimos cargar tus deseos"
          />
        </div>
      );
    }

    const items = wishlistQuery.data ?? [];
    if (items.length === 0) {
      return (
        <div className="mt-4">
          <EmptyState
            action={addButton}
            description="Guardá accesorios, repuestos o ideas para tu vehículo."
            icon="Heart"
            title="Tu próxima mejora empieza acá"
          />
        </div>
      );
    }

    // The API already orders pending first, then by priority and newest; this only splits it.
    const pending = items.filter((item) => !item.purchased);
    const purchased = items.filter((item) => item.purchased);

    return (
      <>
        <div className="mt-4 mb-3 flex justify-end">{addButton}</div>
        {wishlistQuery.isRefetchError ? (
          <div className="mb-3 flex items-center gap-3">
            <Text color="danger" variant="caption">
              No pudimos actualizar los deseos.
            </Text>
            <Button variant="secondary" onClick={() => void wishlistQuery.refetch()}>
              <Text variant="label">Volver a intentar</Text>
            </Button>
          </div>
        ) : null}
        {pending.length ? (
          <ul className="space-y-2.5">
            {pending.map((item) => (
              <WishlistRow
                focusToggle={item.id === lastToggledId}
                item={item}
                key={item.id}
                onDelete={() => setItemToDelete(item)}
                onToggle={() => setLastToggledId(item.id)}
              />
            ))}
          </ul>
        ) : (
          <Text color="muted" variant="body">
            No quedan deseos pendientes.
          </Text>
        )}
        {purchased.length ? (
          <section className="mt-4 border-t border-border pt-4">
            <Text color="muted" variant="caption-strong">
              Comprados · {purchased.length}
            </Text>
            <ul className="mt-2.5 space-y-2.5">
              {purchased.map((item) => (
                <WishlistRow
                  focusToggle={item.id === lastToggledId}
                  item={item}
                  key={item.id}
                  onDelete={() => setItemToDelete(item)}
                  onToggle={() => setLastToggledId(item.id)}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      {renderContent()}
      {formOpen ? (
        <WishlistFormSheet open vehicleId={vehicleId} onOpenChange={setFormOpen} />
      ) : null}
      {itemToDelete ? (
        <DeleteWishlistItemConfirmSheet
          item={itemToDelete}
          open
          onOpenChange={(open) => {
            if (!open) setItemToDelete(null);
          }}
        />
      ) : null}
    </>
  );
}
