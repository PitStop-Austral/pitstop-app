import { InfoField } from '@/components/garage/info-field';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { FUEL_LABELS } from '@/features/vehicles/types';
import type { Vehicle } from '@/features/vehicles/types';
import { formatNumber } from '@/lib/format';

export function IdentificationPanel({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[12px] bg-neutral-100 shadow-sm">
          <Icon color="emphasis" name="CarFront" size="md" />
        </div>
        <Text variant="subheading">Identificación</Text>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5">
        <InfoField label="Marca" value={vehicle.brand} />
        <InfoField label="Modelo" value={vehicle.model} />
        <InfoField label="Año" value={String(vehicle.year)} />
        <InfoField label="Combustible" value={FUEL_LABELS[vehicle.fuel]} />
        <InfoField label="Patente" value={vehicle.plate} />
        <InfoField label="Kilometraje" value={`${formatNumber(vehicle.mileage)} km`} />
      </div>
    </div>
  );
}
