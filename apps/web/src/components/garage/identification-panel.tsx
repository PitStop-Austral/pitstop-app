import { InfoField } from '@/components/garage/info-field';
import { InformationCard } from '@/components/garage/information-card';
import { FUEL_LABELS } from '@/features/vehicles/types';
import type { Vehicle } from '@/features/vehicles/types';
import { VEHICLE_SECTION_ICONS } from '@/features/vehicles/vehicle-section-icons';
import { formatNumber } from '@/lib/format';

export function IdentificationPanel({
  className,
  vehicle,
}: {
  className?: string;
  vehicle: Vehicle;
}) {
  return (
    <InformationCard
      className={className}
      iconSrc={VEHICLE_SECTION_ICONS.identification}
      title="Identificación"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-5">
        <InfoField label="Marca" value={vehicle.brand} />
        <InfoField label="Modelo" value={vehicle.model} />
        <InfoField label="Año" value={String(vehicle.year)} />
        <InfoField label="Combustible" value={FUEL_LABELS[vehicle.fuel]} />
        <InfoField label="Patente" value={vehicle.plate} />
        <InfoField label="Kilometraje" value={`${formatNumber(vehicle.mileage)} km`} />
      </div>
    </InformationCard>
  );
}
