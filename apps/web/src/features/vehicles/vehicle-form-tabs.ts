import type { ComponentProps } from 'react';

import type { Icon } from '@/components/ui/icon';
import type { VehicleFormErrors, VehicleFormValues } from './vehicle-form-schema';

export type VehicleFormTab =
  | 'identificacion'
  | 'lubricantes'
  | 'transmision'
  | 'neumaticos'
  | 'luces';

type VehicleFormTabDefinition = {
  value: VehicleFormTab;
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  fields: readonly (keyof VehicleFormValues)[];
};

export const VEHICLE_FORM_TABS = [
  {
    value: 'identificacion',
    label: 'Identificación',
    icon: 'CarFront',
    fields: ['brand', 'model', 'year', 'fuel', 'plate', 'mileage', 'nickname'],
  },
  {
    value: 'lubricantes',
    label: 'Lubricantes',
    icon: 'Droplets',
    fields: ['engineOilType', 'engineOilLiters', 'gearboxOilType', 'gearboxOilLiters'],
  },
  { value: 'transmision', label: 'Transmisión', icon: 'Cog', fields: ['transmission'] },
  {
    value: 'neumaticos',
    label: 'Neumáticos',
    icon: 'CircleDot',
    fields: ['frontTireSize', 'frontTirePressurePsi', 'rearTireSize', 'rearTirePressurePsi'],
  },
  {
    value: 'luces',
    label: 'Luces',
    icon: 'Lightbulb',
    fields: ['highBeam', 'lowBeam', 'fogLight'],
  },
] as const satisfies readonly VehicleFormTabDefinition[];

export function tabsWithErrors(errors: VehicleFormErrors): Set<VehicleFormTab> {
  return new Set(
    VEHICLE_FORM_TABS.filter((tab) => tab.fields.some((field) => errors[field])).map(
      (tab) => tab.value,
    ),
  );
}

export function firstTabWithError(errors: VehicleFormErrors): VehicleFormTab | null {
  return VEHICLE_FORM_TABS.find((tab) => tab.fields.some((field) => errors[field]))?.value ?? null;
}
