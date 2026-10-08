import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ServiceIcon } from '@/features/maintenances/service-icon';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Schedule } from '@/features/schedules/types';

type HomeScheduleCardProps = {
  schedule: Schedule;
  onClick: () => void;
};

export function HomeScheduleCard({ schedule, onClick }: HomeScheduleCardProps) {
  const dueByDate = schedule.dueReason === 'date' || schedule.dueReason === 'both';
  const dueByMileage = schedule.dueReason === 'mileage' || schedule.dueReason === 'both';
  const isOverdue = schedule.status === 'overdue';
  const urgencyColor = schedule.status === 'overdue' ? 'danger' : 'warning';
  const hasBothMetrics = schedule.remainingDays !== null && schedule.remainingKm !== null;

  return (
    <button
      className={cn(
        'group w-full rounded-[20px] border p-5 text-left transition-all hover:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99]',
        isOverdue ? 'border-primary/30 bg-red-50' : 'border-warning/40 bg-warning-soft',
      )}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-start gap-3.5">
        <ServiceIcon className="bg-card shadow-sm" size="md" type={schedule.type} />
        <div className="min-w-0 flex-1">
          <Text className="line-clamp-2" variant="card-title">
            {schedule.type}
          </Text>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Icon color="muted" name="CalendarCheck2" size="xs" />
            <Text className="truncate" color="muted" variant="caption">
              Último: {formatDate(schedule.baselineDate)} a {formatNumber(schedule.baselineMileage)}{' '}
              km
            </Text>
          </div>
        </div>
        <Icon
          className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
          color="subtle"
          name="ChevronRight"
          size="sm"
        />
      </div>
      <div
        className={cn(
          'mt-3 border-t border-border/80 pt-3',
          hasBothMetrics ? 'grid grid-cols-2 gap-3' : undefined,
        )}
      >
        {schedule.remainingDays !== null ? (
          <DueMetric
            color={urgencyColor}
            description={
              schedule.nextDueDate
                ? `${schedule.remainingDays <= 0 ? 'Venció' : 'Vence'} el ${formatDate(schedule.nextDueDate)}`
                : null
            }
            highlighted={dueByDate}
            icon="Clock3"
            label="Tiempo restante"
            value={`${formatNumber(Math.abs(schedule.remainingDays))} ${Math.abs(schedule.remainingDays) === 1 ? 'día' : 'días'}`}
          />
        ) : null}
        {schedule.remainingKm !== null ? (
          <DueMetric
            className={hasBothMetrics ? 'border-l border-border/80 pl-3' : undefined}
            color={urgencyColor}
            description={
              schedule.nextDueMileage !== null
                ? `${schedule.remainingKm <= 0 ? 'Excedido · límite' : 'Hasta'} ${formatNumber(schedule.nextDueMileage)} km`
                : null
            }
            highlighted={dueByMileage}
            icon="Gauge"
            label={schedule.remainingKm <= 0 ? 'Kms excedidos' : 'Kms restantes'}
            value={`${formatNumber(Math.abs(schedule.remainingKm))} km`}
          />
        ) : null}
      </div>
    </button>
  );
}

function DueMetric({
  className,
  icon,
  label,
  value,
  description,
  highlighted,
  color,
}: {
  className?: string;
  icon: IconName;
  label: string;
  value: string;
  description: string | null;
  highlighted: boolean;
  color: 'danger' | 'warning';
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        <Icon color="muted" name={icon} size="sm" />
        <Text color="muted" variant="caption-strong">
          {label}
        </Text>
      </div>
      <Text className="mt-0.5" color={highlighted ? color : 'muted'} variant="heading">
        {value}
      </Text>
      {description ? (
        <Text className="mt-0.5" color="muted" variant="caption">
          {description}
        </Text>
      ) : null}
    </div>
  );
}
