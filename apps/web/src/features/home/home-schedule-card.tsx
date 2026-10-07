import { StatusChip } from '@/components/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ServiceIcon } from '@/features/maintenances/service-icon';
import { formatNumber } from '@/lib/format';
import type { Schedule } from '@/features/schedules/types';

type HomeScheduleCardProps = {
  schedule: Schedule;
  onClick: () => void;
};

function dueReasonLabel(reason: Schedule['dueReason']): string {
  if (reason === 'date') return 'Fecha';
  if (reason === 'mileage') return 'Kilometraje';
  return 'Fecha y kilometraje';
}

function remainingDaysLabel(days: number): string {
  if (days > 0) return `En ${formatNumber(days)} ${days === 1 ? 'día' : 'días'}`;
  if (days === 0) return 'Vence hoy';
  return `Vencido hace ${formatNumber(Math.abs(days))} ${days === -1 ? 'día' : 'días'}`;
}

function remainingKmLabel(km: number): string {
  if (km > 0) return `En ${formatNumber(km)} km`;
  if (km === 0) return 'Vence ahora';
  return `Vencido hace ${formatNumber(Math.abs(km))} km`;
}

export function HomeScheduleCard({ schedule, onClick }: HomeScheduleCardProps) {
  const dueByDate = schedule.dueReason === 'date' || schedule.dueReason === 'both';
  const dueByMileage = schedule.dueReason === 'mileage' || schedule.dueReason === 'both';
  const urgencyColor = schedule.status === 'overdue' ? 'danger' : 'warning';

  return (
    <button
      className="group flex w-full items-start gap-3.5 rounded-lg border border-border bg-card p-3.5 text-left transition-all hover:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99]"
      type="button"
      onClick={onClick}
    >
      <ServiceIcon size="md" type={schedule.type} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Text className="truncate" variant="card-title">
            {schedule.type}
          </Text>
          <StatusChip status={schedule.status === 'overdue' ? 'overdue' : 'upcoming'} />
        </div>
        <Text className="mt-1.5" color="muted" variant="caption">
          Motivo: {dueReasonLabel(schedule.dueReason)}
        </Text>
        <div className="mt-3 flex flex-col gap-1.5">
          {schedule.remainingDays !== null ? (
            <DueValue
              highlighted={dueByDate}
              icon="CalendarClock"
              value={remainingDaysLabel(schedule.remainingDays)}
              color={urgencyColor}
            />
          ) : null}
          {schedule.remainingKm !== null ? (
            <DueValue
              highlighted={dueByMileage}
              icon="Gauge"
              value={remainingKmLabel(schedule.remainingKm)}
              color={urgencyColor}
            />
          ) : null}
        </div>
      </div>
      <Icon
        className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
        color="subtle"
        name="ChevronRight"
        size="sm"
      />
    </button>
  );
}

function DueValue({
  icon,
  value,
  highlighted,
  color,
}: {
  icon: 'CalendarClock' | 'Gauge';
  value: string;
  highlighted: boolean;
  color: 'danger' | 'warning';
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon color={highlighted ? color : 'muted'} name={icon} size="xs" />
      <Text color={highlighted ? color : 'muted'} variant="caption-strong">
        {value}
      </Text>
    </div>
  );
}
