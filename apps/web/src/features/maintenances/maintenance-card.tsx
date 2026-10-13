import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ServiceIcon } from './service-icon';
import { CATEGORY_LABELS } from './types';
import type { Maintenance } from './types';
import { getNextMaintenanceDue } from './next-maintenance-due';
import type { Schedule } from '../schedules/types';

type MaintenanceCardProps = {
  maintenance: Maintenance;
  schedules?: Schedule[];
  onClick?: () => void;
};

const cardClassName =
  'group flex w-full items-start gap-3.5 rounded-lg border border-border bg-card p-3.5 text-left transition-all hover:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99]';

export function MaintenanceCard({ maintenance, schedules, onClick }: MaintenanceCardProps) {
  const isRepair = maintenance.category === 'ARREGLO';
  const nextDue = getNextMaintenanceDue(maintenance.type, schedules);

  const content = (
    <>
      <ServiceIcon size="md" type={maintenance.type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text className="truncate" variant="body-strong">
            {maintenance.type}
          </Text>
          <Badge className="shrink-0" variant={isRepair ? 'primary' : 'neutral'}>
            <Text color={isRepair ? 'primary' : 'muted'} variant="caption-strong">
              {CATEGORY_LABELS[maintenance.category]}
            </Text>
          </Badge>
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon color="muted" name="CalendarCheck2" size="xs" />
            <Text color="muted" variant="caption">
              Último:
            </Text>
            <Text className="truncate" variant="caption-strong">
              {formatDate(maintenance.date)} · {formatNumber(maintenance.mileage)} km
            </Text>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon color="subtle" name="CalendarClock" size="xs" />
            <Text color="muted" variant="caption">
              Próximo:
            </Text>
            {nextDue ? (
              <Text color="subtle" variant="caption">
                {nextDue}
              </Text>
            ) : (
              <Text color="subtle" variant="caption">
                Sin frecuencia definida
              </Text>
            )}
          </div>
        </div>
      </div>

      <Icon
        className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
        color="subtle"
        name="ChevronRight"
        size="sm"
      />
    </>
  );

  // Without an action the card stays a plain container instead of a focusable button
  // that does nothing.
  if (!onClick) {
    return <div className={cardClassName}>{content}</div>;
  }

  return (
    <button className={cn(cardClassName, 'cursor-pointer')} type="button" onClick={onClick}>
      {content}
    </button>
  );
}
