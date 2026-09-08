export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}
