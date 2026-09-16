import { Text } from '@/components/ui/text';

export function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Text color="muted" variant="label">
        {label}
      </Text>
      <Text className="mt-1 break-words" variant="body-strong">
        {value}
      </Text>
    </div>
  );
}
