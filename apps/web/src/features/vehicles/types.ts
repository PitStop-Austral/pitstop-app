export const FUEL_TYPES = ['NAFTA', 'DIESEL', 'GNC', 'HIBRIDO', 'ELECTRICO'] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_LABELS: Record<FuelType, string> = {
  NAFTA: 'Nafta',
  DIESEL: 'Diésel',
  GNC: 'GNC',
  HIBRIDO: 'Híbrido',
  ELECTRICO: 'Eléctrico',
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
  createdAt: string;
  updatedAt: string;
};

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;
export type VehicleUpdateInput = Partial<VehicleInput>;
