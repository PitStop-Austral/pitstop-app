import { formatNumber } from '../../lib/format.ts';

function daysPart(days: number): string {
  const count = Math.abs(days);
  const unit = count === 1 ? 'día' : 'días';
  if (days < 0) return `vencida hace ${count} ${unit}`;
  if (days === 0) return 'venció hoy';
  return `${count === 1 ? 'falta' : 'faltan'} ${count} ${unit}`;
}

function kmPart(km: number): string {
  if (km < 0) return `pasada por ${formatNumber(-km)}\u00A0km`;
  if (km === 0) return 'llegó al kilometraje';
  return `faltan ${formatNumber(km)}\u00A0km`;
}

// Each criterion is described by its own sign: a schedule can be overdue by date while it still
// has kilometers left, and vice versa.
export function formatRemaining(
  remainingDays: number | null,
  remainingKm: number | null,
): string | null {
  const parts = [
    remainingDays == null ? null : daysPart(remainingDays),
    remainingKm == null ? null : kmPart(remainingKm),
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
