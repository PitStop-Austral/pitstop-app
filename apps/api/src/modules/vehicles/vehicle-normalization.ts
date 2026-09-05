export function normalizeVehiclePlate(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}
