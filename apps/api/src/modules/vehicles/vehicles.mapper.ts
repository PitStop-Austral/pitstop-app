import type { VehicleView } from './vehicles.repository';

export type VehicleResponse = Omit<VehicleView, 'engineOilLiters' | 'gearboxOilLiters'> & {
  engineOilLiters: number | null;
  gearboxOilLiters: number | null;
};

export function toVehicleResponse(vehicle: VehicleView): VehicleResponse {
  return {
    ...vehicle,
    engineOilLiters: vehicle.engineOilLiters?.toNumber() ?? null,
    gearboxOilLiters: vehicle.gearboxOilLiters?.toNumber() ?? null,
  };
}
