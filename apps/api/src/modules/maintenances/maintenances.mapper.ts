import type { MaintenanceView } from './maintenances.repository';
import type { ScheduleResponse } from '../schedules/schedules.mapper';

export type MaintenanceResponse = Omit<MaintenanceView, 'date' | 'cost'> & {
  date: string;
  cost: number | null;
};

export type MaintenanceCreatedResponse = MaintenanceResponse & {
  isFirstMaintenance: boolean;
};

export type MaintenanceDetailResponse = MaintenanceResponse & { schedule: ScheduleResponse | null };

export function toMaintenanceResponse(maintenance: MaintenanceView): MaintenanceResponse {
  return {
    ...maintenance,
    date: maintenance.date.toISOString().slice(0, 10),
    cost: maintenance.cost?.toNumber() ?? null,
  };
}
