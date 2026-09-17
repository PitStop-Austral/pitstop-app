import { Odometer } from '@/components/odometer';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { FUEL_LABELS } from '@/features/vehicles/types';
import type { Vehicle } from '@/features/vehicles/types';

type VehicleHeroCardProps = {
  vehicle: Vehicle;
  onUpdateMileage: () => void;
};

export function VehicleHeroCard({ vehicle, onUpdateMileage }: VehicleHeroCardProps) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-4 lg:sticky lg:top-10">
      <div className="grid aspect-video place-items-center rounded-[16px] bg-neutral-100 lg:aspect-[4/3]">
        <Icon color="subtle" name="CarFront" size="xl" strokeWidth={1.5} />
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <Text variant="subheading">
            {vehicle.brand} {vehicle.model}
          </Text>
          <StatusChip status="current" />
        </div>
        <Text className="mt-1" color="muted" variant="body">
          {vehicle.year} · {FUEL_LABELS[vehicle.fuel]}
          {vehicle.nickname ? ` · "${vehicle.nickname}"` : ''}
        </Text>
        <div className="mt-4">
          <Odometer value={vehicle.mileage} />
          <Button
            className="mt-1 h-auto px-0 hover:underline"
            variant="ghost"
            onClick={onUpdateMileage}
          >
            <Text color="primary" variant="caption-strong">
              Actualizar km
            </Text>
          </Button>
        </div>
      </div>
    </div>
  );
}
