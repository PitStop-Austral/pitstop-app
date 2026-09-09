import { Text } from '@/components/ui/text';

export function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text color="muted" variant="label">
        {label}
      </Text>
      <Text className="mt-1" variant="body-strong">
        {value}
      </Text>
    </div>
  );
}
