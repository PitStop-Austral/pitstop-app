import type { MaintenanceView } from './maintenances.repository';

export type MaintenanceResponse = Omit<MaintenanceView, 'date' | 'cost'> & {
  date: string;
  cost: number | null;
};

export function toMaintenanceResponse(maintenance: MaintenanceView): MaintenanceResponse {
  return {
    ...maintenance,
    date: maintenance.date.toISOString().slice(0, 10),
    cost: maintenance.cost?.toNumber() ?? null,
  };
}
