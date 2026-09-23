import { useEffect } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Badge } from '@/components/ui/badge';
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
import type { ApiError } from '@/lib/api-client';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMaintenance } from './queries';
import { ServiceIcon } from './service-icon';
import { CATEGORY_LABELS } from './types';
import type { Maintenance } from './types';

type MaintenanceDetailSheetProps = {
  vehicleId: string;
  maintenanceId: string;
  onOpenChange: (open: boolean) => void;
  onEdit: (maintenance: Maintenance) => void;
  onDelete: (maintenance: Maintenance) => void;
};

const NOT_SPECIFIED = 'No especificado';

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as ApiError).status === 404;
}

export function MaintenanceDetailSheet({
  vehicleId,
  maintenanceId,
  onOpenChange,
  onEdit,
  onDelete,
}: MaintenanceDetailSheetProps) {
  const { data: maintenance, error, isLoadingError } = useMaintenance(vehicleId, maintenanceId);
  // A failed background refetch keeps the cached detail on screen; only a first load that
  // failed or a maintenance that no longer exists closes the sheet.
  const shouldClose = isLoadingError || isNotFound(error);

  useEffect(() => {
    if (!shouldClose) return;
    onOpenChange(false);
    toast.error('No encontramos ese mantenimiento');
  }, [shouldClose, onOpenChange]);

  const isRepair = maintenance?.category === 'ARREGLO';

  return (
    <BottomSheet
      description="Servicio completado"
      footer={
        <Button className="w-full" variant="secondary" onClick={() => onOpenChange(false)}>
          <Text variant="label">Cerrar</Text>
        </Button>
      }
      footerClassName="lg:hidden"
      headerAction={
        maintenance ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Opciones del mantenimiento"
              className={buttonVariants({ variant: 'icon', size: 'icon' })}
            >
              <Icon color="muted" name="EllipsisVertical" size="md" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onEdit(maintenance)}>
                <Icon name="Pencil" size="sm" />
                <Text variant="label">Editar</Text>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(maintenance)}>
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
      onOpenChange={onOpenChange}
      title={maintenance?.type ?? 'Servicio'}
    >
      {maintenance ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5 rounded-lg bg-neutral-100 p-4">
            <ServiceIcon className="bg-card shadow-sm" size="md" type={maintenance.type} />
            <div className="min-w-0">
              <Text color="default" variant="card-title">
                {maintenance.type}
              </Text>
              <Badge
                className={cn('mt-1', !isRepair && 'bg-card')}
                variant={isRepair ? 'primary' : 'neutral'}
              >
                <Text color={isRepair ? 'primary' : 'muted'} variant="caption-strong">
                  {CATEGORY_LABELS[maintenance.category]}
                </Text>
              </Badge>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <DetailRow label="Fecha" value={formatDate(maintenance.date)} />
            <DetailRow label="Kilometraje" value={`${formatNumber(maintenance.mileage)} km`} />
            <DetailRow label="Taller / lugar" value={maintenance.workshop ?? NOT_SPECIFIED} />
            <DetailRow
              label="Costo"
              value={maintenance.cost === null ? NOT_SPECIFIED : formatCurrency(maintenance.cost)}
            />
          </div>

          {maintenance.notes ? (
            <div className="rounded-lg bg-neutral-100 p-4">
              <Text color="muted" variant="caption-strong">
                Notas
              </Text>
              <div className="whitespace-pre-line">
                <Text className="mt-1" color="default" variant="body">
                  {maintenance.notes}
                </Text>
              </div>
            </div>
          ) : null}
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
        <Text color="default" variant="body-strong">
          {value}
        </Text>
      </div>
    </div>
  );
}
