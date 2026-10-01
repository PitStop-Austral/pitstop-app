export const DEFAULT_SCHEDULES = [
  { type: 'Cambio de aceite', intervalKm: 10_000, intervalMonths: 6 },
  { type: 'Alineación de neumáticos', intervalKm: 10_000, intervalMonths: 12 },
  { type: 'Filtro de aire', intervalKm: 15_000, intervalMonths: 12 },
  { type: 'Filtro de aceite', intervalKm: 10_000, intervalMonths: 6 },
  { type: 'Correa de distribución', intervalKm: 100_000, intervalMonths: 60 },
] as const;

export function normalizeScheduleType(type: string): string {
  return type.toLocaleLowerCase('es-AR');
}
