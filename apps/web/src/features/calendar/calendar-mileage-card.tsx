import { StatusChip } from '@/components/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ServiceIcon } from '@/features/maintenances/service-icon';
import type { Schedule, ScheduleStatus } from '@/features/schedules/types';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

type CalendarMileageCardProps = {
  schedule: Schedule;
  onClick?: () => void;
};

const CHIP_STATUS = {
  overdue: 'overdue',
  upcoming: 'upcoming',
  on_track: 'current',
} as const satisfies Record<ScheduleStatus, string>;

const cardClassName =
  'flex w-full items-center gap-3.5 rounded-lg border border-border bg-card p-3.5 text-left';

function remainingKmLabel(remainingKm: number): string {
  if (remainingKm > 0) return `Faltan ${formatNumber(remainingKm)} km`;
  if (remainingKm === 0) return 'Vence ahora';
  return `Vencido hace ${formatNumber(-remainingKm)} km`;
}

export function CalendarMileageCard({ schedule, onClick }: CalendarMileageCardProps) {
  const content = (
    <>
      <ServiceIcon size="md" type={schedule.type} />

      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 min-w-0 break-words">
          <Text variant="card-title">{schedule.type}</Text>
        </div>
        <div className="mt-1 flex flex-col">
          {schedule.nextDueMileage != null ? (
            <Text color="muted" variant="caption">
              {`Próximo a los ${formatNumber(schedule.nextDueMileage)} km`}
            </Text>
          ) : null}
          {schedule.remainingKm != null ? (
            <Text color="muted" variant="caption">
              {remainingKmLabel(schedule.remainingKm)}
            </Text>
          ) : null}
        </div>
        <div className="mt-2">
          <StatusChip status={CHIP_STATUS[schedule.status]} />
        </div>
      </div>

      {onClick ? <Icon className="shrink-0" color="subtle" name="ChevronRight" size="sm" /> : null}
    </>
  );

  if (!onClick) {
    return <div className={cardClassName}>{content}</div>;
  }

  return (
    <button
      className={cn(
        cardClassName,
        'cursor-pointer hover:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}
