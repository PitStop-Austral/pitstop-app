export const FUEL_TYPES = ['NAFTA', 'DIESEL', 'GNC', 'HIBRIDO', 'ELECTRICO'] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export const TRANSMISSION_TYPES = [
  'MANUAL',
  'AUTOMATICA',
  'CVT',
  'DOBLE_EMBRAGUE',
  'OTRO',
] as const;

export type TransmissionType = (typeof TRANSMISSION_TYPES)[number];

export const FUEL_LABELS: Record<FuelType, string> = {
  NAFTA: 'Nafta',
  DIESEL: 'Diésel',
  GNC: 'GNC',
  HIBRIDO: 'Híbrido',
  ELECTRICO: 'Eléctrico',
};

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  MANUAL: 'Manual',
  AUTOMATICA: 'Automática',
  CVT: 'CVT',
  DOBLE_EMBRAGUE: 'Doble embrague',
  OTRO: 'Otro',
};

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  year: number;
  fuel: FuelType;
  plate: string;
  mileage: number;
  nickname: string | null;
  engineOilType: string | null;
  engineOilLiters: number | null;
  gearboxOilType: string | null;
  gearboxOilLiters: number | null;
  transmission: TransmissionType | null;
  frontTireSize: string | null;
  frontTirePressurePsi: number | null;
  rearTireSize: string | null;
  rearTirePressurePsi: number | null;
  highBeam: string | null;
  lowBeam: string | null;
  fogLight: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;
export type VehicleUpdateInput = Partial<VehicleInput>;
