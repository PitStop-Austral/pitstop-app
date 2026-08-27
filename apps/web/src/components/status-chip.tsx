import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

const statuses = {
  current: {
    label: 'Al día',
    icon: 'CheckCircle2',
    styles: 'bg-success-soft text-success-strong',
    color: 'success',
  },
  upcoming: {
    label: 'Próximo',
    icon: 'AlertTriangle',
    styles: 'bg-warning-soft text-warning-strong',
    color: 'warning',
  },
  overdue: {
    label: 'Vencido',
    icon: 'AlertCircle',
    styles: 'bg-red-50 text-primary',
    color: 'primary',
  },
} as const;

export function StatusChip({ status }: { status: keyof typeof statuses }) {
  const item = statuses[status];
  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${item.styles}`}>
      <Icon color={item.color} name={item.icon} size="xs" strokeWidth={2.25} />
      <Text color={item.color} variant="caption-strong">
        {item.label}
      </Text>
    </div>
  );
}
