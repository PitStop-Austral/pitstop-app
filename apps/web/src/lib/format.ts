export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}

// 'es' instead of 'es-AR': both abbreviate the month the same way, but es-AR renders
// "12 de mar de 2026" while the design asks for "12 mar 2026". The date is built at local
// midnight so a YYYY-MM-DD value never shifts to the previous day.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`));
}

// Whole amounts drop the decimals; amounts with cents always show two (1.5 → "$ 1,50").
export function formatCurrency(value: number): string {
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
