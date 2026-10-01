import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ServiceIcon } from '@/features/maintenances/service-icon';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Schedule } from './types';

type ScheduleCardProps = {
  schedule: Schedule;
  onClick?: () => void;
};

const cardClassName =
  'flex w-full cursor-pointer items-center gap-3.5 rounded-[16px] border border-border bg-card p-3.5 text-left';

// The 14 px icon sits 1 px down so it stays aligned with the first 16 px caption line if the text wraps.
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
  const content = (
    <>
      <ServiceIcon size="md" type={schedule.type} />

      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 min-w-0 break-words">
          <Text variant="card-title">{schedule.type}</Text>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {schedule.intervalKm != null ? (
            <Detail icon="Gauge">{`Cada ${formatNumber(schedule.intervalKm)}\u00A0km`}</Detail>
          ) : null}
          {schedule.intervalMonths != null ? (
            <Detail icon="CalendarDays">
              {`Cada ${schedule.intervalMonths} ${schedule.intervalMonths === 1 ? 'mes' : 'meses'}`}
            </Detail>
          ) : null}
        </div>
      </div>

      <Icon className="shrink-0" color="subtle" name="ChevronRight" size="sm" />
    </>
  );

  // PIT-57 passes onClick to open the detail; until then the card is a plain container.
  if (!onClick) {
    return <div className={cardClassName}>{content}</div>;
  }

  return (
    <button
      className={cn(cardClassName, 'focus-visible:ring-[3px] focus-visible:ring-ring/50')}
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}
