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
  const vehicleName = activeVehicle
    ? `${activeVehicle.brand} ${activeVehicle.model}`
    : 'Agregar vehículo';
  const label = isLoading ? 'Cargando vehículo' : vehicleName;

  return (
    <button
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
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100">
        <Icon color="muted" name="CarFront" size="sm" />
      </div>
      {!compact ? (
        <Text className="min-w-0 flex-1 truncate text-left" variant="label">
          {label}
        </Text>
      ) : null}
      {!compact ? <Icon color="subtle" name="ChevronDown" size="sm" /> : null}
    </button>
  );
}
