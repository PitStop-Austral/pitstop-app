export type Schedule = {
  id: string;
  vehicleId: string;
  type: string;
  intervalMonths: number | null;
  intervalKm: number | null;
  baselineDate: string;
  baselineMileage: number;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleInput = Pick<Schedule, 'type' | 'intervalMonths' | 'intervalKm'>;
