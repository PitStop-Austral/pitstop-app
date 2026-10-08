import { useEffect } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { StatusChip } from '@/components/status-chip';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import { ServiceIcon } from '@/features/maintenances/service-icon';
import type { ApiError } from '@/lib/api-client';
import { formatDate, formatNumber } from '@/lib/format';
import { useSchedule } from './queries';
import type { Schedule } from './types';

type ScheduleDetailSheetProps = {
  vehicleId: string;
  scheduleId: string;
  onOpenChange: (open: boolean) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
  onRegisterCompleted: (schedule: Schedule) => void;
};

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as ApiError).status === 404;
}

function monthInterval(months: number): string {
  return `${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export function ScheduleDetailSheet({
  vehicleId,
  scheduleId,
  onOpenChange,
  onEdit,
  onDelete,
  onRegisterCompleted,
}: ScheduleDetailSheetProps) {
  const { data: schedule, error, isLoadingError } = useSchedule(vehicleId, scheduleId);
  const shouldClose = isLoadingError || isNotFound(error);

  useEffect(() => {
    if (!shouldClose) return;
    onOpenChange(false);
    toast.error('No encontramos esa frecuencia');
  }, [shouldClose, onOpenChange]);

  return (
    <BottomSheet
      description="Frecuencia recomendada"
      footer={
        schedule ? (
          <Button className="w-full" onClick={() => onRegisterCompleted(schedule)}>
            <Text color="on-primary" variant="label">
              Registrar completado
            </Text>
          </Button>
        ) : null
      }
      headerAction={
        schedule ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Opciones de la frecuencia"
              className={buttonVariants({ variant: 'icon', size: 'icon' })}
            >
              <Icon color="muted" name="EllipsisVertical" size="md" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onEdit(schedule)}>
                <Icon name="Pencil" size="sm" />
                <Text variant="label">Editar</Text>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(schedule)}>
                <Icon color="danger" name="Trash2" size="sm" />
                <Text color="danger" variant="label">
                  Eliminar
                </Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
      open
      title={schedule?.type ?? 'Frecuencia'}
      onOpenChange={onOpenChange}
    >
      {schedule ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5 rounded-lg bg-neutral-100 p-4">
            <ServiceIcon className="bg-card shadow-sm" size="md" type={schedule.type} />
            <div className="min-w-0 flex-1">
              <Text variant="card-title">{schedule.type}</Text>
              <div className="mt-1.5">
                <StatusChip status={schedule.status === 'on_track' ? 'current' : schedule.status} />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {schedule.intervalKm !== null ? (
              <DetailRow
                label="Por kilometraje"
                value={`Cada ${formatNumber(schedule.intervalKm)} km`}
              />
            ) : null}
            {schedule.intervalMonths !== null ? (
              <DetailRow
                label="Por tiempo"
                value={`Cada ${monthInterval(schedule.intervalMonths)}`}
              />
            ) : null}
          </div>

          <div>
            <Text className="mb-2" color="muted" variant="caption-strong">
              Referencia
            </Text>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <DetailRow label="Fecha base" value={formatDate(schedule.baselineDate)} />
              <DetailRow
                label="Kilometraje base"
                value={`${formatNumber(schedule.baselineMileage)} km`}
              />
            </div>
          </div>

          <div>
            <Text className="mb-2" color="muted" variant="caption-strong">
              Próximo vencimiento
            </Text>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {schedule.nextDueDate !== null ? (
                <DetailRow label="Fecha" value={formatDate(schedule.nextDueDate)} />
              ) : null}
              {schedule.nextDueMileage !== null ? (
                <DetailRow
                  label="Kilometraje"
                  value={`${formatNumber(schedule.nextDueMileage)} km`}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center">
          <Icon className="animate-spin" color="primary" name="Loader2" size="lg" />
        </div>
      )}
    </BottomSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
      <Text color="muted" variant="body">
        {label}
      </Text>
      <div className="max-w-[62%] text-right break-words">
        <Text variant="body-strong">{value}</Text>
      </div>
    </div>
  );
}
