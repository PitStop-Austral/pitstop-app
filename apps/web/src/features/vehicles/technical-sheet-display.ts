import { formatNumber } from '../../lib/format.ts';

const UNDEFINED_VALUE = 'A definir';

export function formatTechnicalText(value: string | null): string {
  return value?.trim() || UNDEFINED_VALUE;
}

function formatMeasurement(
  value: number | null,
  unit: string,
  format: (value: number) => string,
): string {
  return value === null ? UNDEFINED_VALUE : `${format(value)} ${unit}`;
}

export function formatOilSpecification(type: string | null, liters: number | null): string {
  return `${formatTechnicalText(type)} · ${formatMeasurement(liters, 'L', (value) => String(value))}`;
}

export function formatTireSpecification(size: string | null, pressurePsi: number | null): string {
  return `${formatTechnicalText(size)} · ${formatMeasurement(pressurePsi, 'PSI', formatNumber)}`;
}
