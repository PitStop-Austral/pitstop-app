import { BottomSheet } from '@/components/bottom-sheet';
import { StatusChip } from '@/components/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CATEGORY_LABELS } from '@/features/maintenances/types';
import { ServiceIcon } from '@/features/maintenances/service-icon';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { formatFullDate } from './calendar-events';
import type { CalendarEvent } from './types';

type DayMaintenanceSheetProps = {
  date: string;
  events: CalendarEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEvent: (event: CalendarEvent) => void;
};

const CHIP_STATUS = {
  completed: { status: 'current', label: 'Completado' },
  overdue: { status: 'overdue', label: 'Vencido' },
  scheduled: { status: 'upcoming', label: 'A realizar' },
} as const;

function eventDetail(event: CalendarEvent): string {
  if (event.source === 'maintenance') {
    return `${CATEGORY_LABELS[event.maintenance.category]} · ${formatNumber(event.maintenance.mileage)} km`;
  }

  return event.schedule.nextDueMileage === null
    ? 'Programado por fecha'
    : `Próximo a los ${formatNumber(event.schedule.nextDueMileage)} km`;
}

export function DayMaintenanceSheet({
  date,
  events,
  open,
  onOpenChange,
  onSelectEvent,
}: DayMaintenanceSheetProps) {
  return (
    <BottomSheet
      description={formatFullDate(date)}
      open={open}
      title="Mantenimientos del día"
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-2.5">
        {events.map((event) => {
          const chip = CHIP_STATUS[event.state];
          const type =
            event.source === 'maintenance' ? event.maintenance.type : event.schedule.type;

          return (
            <button
              key={event.id}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3.5 text-left',
                'cursor-pointer hover:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50',
              )}
              type="button"
              onClick={() => onSelectEvent(event)}
            >
              <ServiceIcon size="md" type={type} />
              <div className="min-w-0 flex-1">
                <Text className="break-words" variant="card-title">
                  {type}
                </Text>
                <Text className="mt-1 block break-words" color="muted" variant="caption">
                  {eventDetail(event)}
                </Text>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusChip label={chip.label} status={chip.status} />
                <Icon color="subtle" name="ChevronRight" size="sm" />
              </div>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
