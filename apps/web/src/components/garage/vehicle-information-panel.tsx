import { IdentificationPanel } from '@/components/garage/identification-panel';
import { InfoField } from '@/components/garage/info-field';
import { InformationCard } from '@/components/garage/information-card';
import { Text } from '@/components/ui/text';
import {
  formatOilSpecification,
  formatTechnicalText,
  formatTireSpecification,
} from '@/features/vehicles/technical-sheet-display';
import { TRANSMISSION_LABELS } from '@/features/vehicles/types';
import type { Vehicle } from '@/features/vehicles/types';
import { VEHICLE_SECTION_ICONS } from '@/features/vehicles/vehicle-section-icons';

export function VehicleInformationPanel({ vehicle }: { vehicle: Vehicle }) {
  const transmission = vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <IdentificationPanel className="xl:col-span-2" vehicle={vehicle} />

      <InformationCard iconSrc={VEHICLE_SECTION_ICONS.lubricants} title="Lubricantes">
        <div className="space-y-5">
          <InformationRow
            label="Aceite de motor"
            value={formatOilSpecification(vehicle.engineOilType, vehicle.engineOilLiters)}
          />
          <InformationRow
            label="Aceite de caja"
            value={formatOilSpecification(vehicle.gearboxOilType, vehicle.gearboxOilLiters)}
          />
        </div>
      </InformationCard>

      <InformationCard iconSrc={VEHICLE_SECTION_ICONS.transmission} title="Transmisión">
        <InformationRow label="Tipo" value={formatTechnicalText(transmission)} />
      </InformationCard>

      <InformationCard iconSrc={VEHICLE_SECTION_ICONS.tires} title="Neumáticos">
        <div className="space-y-5">
          <InformationRow
            label="Delanteros"
            value={formatTireSpecification(vehicle.frontTireSize, vehicle.frontTirePressurePsi)}
          />
          <InformationRow
            label="Traseros"
            value={formatTireSpecification(vehicle.rearTireSize, vehicle.rearTirePressurePsi)}
          />
        </div>
      </InformationCard>

      <InformationCard iconSrc={VEHICLE_SECTION_ICONS.lights} title="Luces">
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          <InfoField label="Altas" value={formatTechnicalText(vehicle.highBeam)} />
          <InfoField label="Bajas" value={formatTechnicalText(vehicle.lowBeam)} />
          <InfoField label="Antinieblas" value={formatTechnicalText(vehicle.fogLight)} />
        </div>
      </InformationCard>
    </div>
  );
}

function InformationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-3">
      <Text color="muted" variant="label">
        {label}
      </Text>
      <Text className="min-w-0 break-words text-right" variant="body-strong">
        {value}
      </Text>
    </div>
  );
}
