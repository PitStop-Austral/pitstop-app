import { Text } from '@/components/ui/text';

export function Odometer({ value, unit = 'km' }: { value: number; unit?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <Text variant="numeric">{new Intl.NumberFormat('es-AR').format(value)}</Text>
      <Text color="muted" variant="label">
        {unit}
      </Text>
    </div>
  );
}
