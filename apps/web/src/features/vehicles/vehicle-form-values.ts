import type { Vehicle } from './types';
import type { VehicleFormValues } from './vehicle-form-schema';

export function initialValues(vehicle?: Vehicle): VehicleFormValues {
  return {
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: vehicle ? String(vehicle.year) : '',
    fuel: vehicle?.fuel ?? 'NAFTA',
    plate: vehicle?.plate ?? '',
    mileage: vehicle ? String(vehicle.mileage) : '',
    nickname: vehicle?.nickname ?? '',
    engineOilType: vehicle?.engineOilType ?? '',
    engineOilLiters:
      vehicle?.engineOilLiters === null ? '' : String(vehicle?.engineOilLiters ?? ''),
    gearboxOilType: vehicle?.gearboxOilType ?? '',
    gearboxOilLiters:
      vehicle?.gearboxOilLiters === null ? '' : String(vehicle?.gearboxOilLiters ?? ''),
    transmission: vehicle?.transmission ?? '',
    frontTireSize: vehicle?.frontTireSize ?? '',
    frontTirePressurePsi:
      vehicle?.frontTirePressurePsi === null ? '' : String(vehicle?.frontTirePressurePsi ?? ''),
    rearTireSize: vehicle?.rearTireSize ?? '',
    rearTirePressurePsi:
      vehicle?.rearTirePressurePsi === null ? '' : String(vehicle?.rearTirePressurePsi ?? ''),
    highBeam: vehicle?.highBeam ?? '',
    lowBeam: vehicle?.lowBeam ?? '',
    fogLight: vehicle?.fogLight ?? '',
  };
}
