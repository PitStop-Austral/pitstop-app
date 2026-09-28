export const MAINTENANCE_CATEGORIES = ['MANTENIMIENTO', 'ARREGLO'] as const;

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  MANTENIMIENTO: 'Mantenimiento',
  ARREGLO: 'Arreglo',
};

export type Maintenance = {
  id: string;
  vehicleId: string;
  type: string;
  category: MaintenanceCategory;
  date: string;
  mileage: number;
  workshop: string | null;
  cost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceInput = Omit<Maintenance, 'id' | 'vehicleId' | 'createdAt' | 'updatedAt'>;
