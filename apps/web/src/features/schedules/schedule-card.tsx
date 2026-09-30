import { StatusChip } from '@/components/status-chip';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ServiceIcon } from '@/features/maintenances/service-icon';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { formatRemaining } from './format-remaining';
import type { Schedule, ScheduleStatus } from './types';

type ScheduleCardProps = {
  schedule: Schedule;
  onClick?: () => void;
};

const CHIP_STATUS: Record<ScheduleStatus, 'overdue' | 'upcoming' | 'current'> = {
  overdue: 'overdue',
  upcoming: 'upcoming',
  on_track: 'current',
};

const cardClassName =
  'group flex w-full items-start gap-3.5 rounded-[16px] border border-border bg-card p-3.5 text-left transition-all hover:shadow-sm';

// Lines wrap instead of truncating so dates, kilometers and the remaining margin are never cut;
// the icon stays on the first line (14 px icon on a 16 px caption line).
function Detail({ icon, children }: { icon: IconName; children: string }) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon className="mt-px shrink-0" color="muted" name={icon} size="xs" />
      <Text className="min-w-0" color="muted" variant="caption">
        {children}
      </Text>
    </div>
  );
}

export function ScheduleCard({ schedule, onClick }: ScheduleCardProps) {
  const nextDue = [
    schedule.nextDueDate && formatDate(schedule.nextDueDate),
    schedule.nextDueMileage != null && `${formatNumber(schedule.nextDueMileage)}\u00A0km`,
  ]
    .filter(Boolean)
    .join(' · ');
  const remaining = formatRemaining(schedule.remainingDays, schedule.remainingKm);

  const content = (
    <>
      <ServiceIcon size="md" type={schedule.type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Text className="line-clamp-2 min-w-0 break-words" variant="card-title">
            {schedule.type}
          </Text>
          <div className="shrink-0">
            <StatusChip status={CHIP_STATUS[schedule.status]} />
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          {schedule.intervalKm != null ? (
            <Detail icon="Gauge">{`Cada ${formatNumber(schedule.intervalKm)}\u00A0km`}</Detail>
          ) : null}
          {schedule.intervalMonths != null ? (
            <Detail icon="CalendarDays">
              {`Cada ${schedule.intervalMonths} ${schedule.intervalMonths === 1 ? 'mes' : 'meses'}`}
            </Detail>
          ) : null}
          {nextDue ? <Detail icon="CalendarClock">{`Próximo: ${nextDue}`}</Detail> : null}
          {remaining ? <Detail icon="Hourglass">{remaining}</Detail> : null}
        </div>
      </div>

      {onClick ? (
        <Icon
          className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
          color="subtle"
          name="ChevronRight"
          size="sm"
        />
      ) : null}
    </>
  );

  // Without an action the card is a plain container: no chevron, no focus, nothing clickable.
  if (!onClick) {
    return <div className={cardClassName}>{content}</div>;
  }

  return (
    <button
      className={cn(
        cardClassName,
        'cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99]',
      )}
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}
