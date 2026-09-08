import { Text } from '@/components/ui/text';
import { formatNumber } from '@/lib/format';

export function Odometer({ value, unit = 'km' }: { value: number; unit?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <Text variant="numeric">{formatNumber(value)}</Text>
      <Text color="muted" variant="label">
        {unit}
      </Text>
    </div>
  );
}
