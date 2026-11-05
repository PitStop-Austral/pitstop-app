import { useEffect, useState } from 'react';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { Vehicle } from './types';

type ActiveVehicleButtonProps = {
  activeVehicle?: Vehicle;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick: () => void;
};

export function ActiveVehicleButton({
  activeVehicle,
  className,
  compact = false,
  disabled = false,
  isLoading = false,
  onClick,
}: ActiveVehicleButtonProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [activeVehicle?.photoUrl]);
  const vehicleName = activeVehicle
    ? `${activeVehicle.brand} ${activeVehicle.model}`
    : 'Agregar vehículo';
  const nickname = activeVehicle?.nickname?.trim() || undefined;
  const label = isLoading ? 'cargando' : nickname ? `${vehicleName}, ${nickname}` : vehicleName;

  return (
    <button
      aria-busy={isLoading}
      aria-label={`Vehículo activo: ${label}`}
      className={cn(
        'flex h-12 min-w-0 items-center rounded-full border border-border bg-card shadow-sm transition hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        compact ? 'size-12 justify-center' : 'gap-2.5 px-2.5 pr-3',
        className,
      )}
      disabled={disabled || isLoading}
      type="button"
      onClick={onClick}
    >
      <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-100">
        {isLoading ? (
          <Icon
            className="animate-spin motion-reduce:animate-none"
            color="muted"
            name="Loader2"
            size="sm"
          />
        ) : activeVehicle?.photoUrl && !imageFailed ? (
          <img
            alt={`${activeVehicle.brand} ${activeVehicle.model}`}
            className="block size-full object-cover"
            src={activeVehicle.photoUrl}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon color="muted" name="CarFront" size="sm" />
        )}
      </div>
      {compact ? null : isLoading ? (
        <Text className="min-w-0 flex-1 truncate text-left" color="muted" variant="label">
          Cargando…
        </Text>
      ) : nickname ? (
        <div className="min-w-0 flex-1 text-left">
          <Text className="block truncate leading-tight" variant="label">
            {vehicleName}
          </Text>
          <Text className="block truncate leading-tight" color="muted" variant="caption">
            {nickname}
          </Text>
        </div>
      ) : (
        <Text className="min-w-0 flex-1 truncate text-left" variant="label">
          {vehicleName}
        </Text>
      )}
      {!compact ? <Icon color="subtle" name="ChevronDown" size="sm" /> : null}
    </button>
  );
}
