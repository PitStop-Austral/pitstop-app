import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { useSetActiveVehicle } from './queries';
import type { Vehicle } from './types';

type VehiclePickerSheetProps = {
  activeVehicle?: Vehicle;
  onAddVehicle: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  vehicles: Vehicle[];
};

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export function VehiclePickerSheet({
  activeVehicle,
  onAddVehicle,
  onOpenChange,
  open,
  vehicles,
}: VehiclePickerSheetProps) {
  const setActiveVehicle = useSetActiveVehicle();

  async function selectVehicle(vehicle: Vehicle) {
    if (vehicle.id === activeVehicle?.id) {
      onOpenChange(false);
      return;
    }

    try {
      await setActiveVehicle.mutateAsync(vehicle.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'No pudimos cambiar el vehículo');
    }
  }

  return (
    <BottomSheet
      footer={
        <Button
          className="w-full gap-2"
          variant="secondary"
          onClick={() => {
            onOpenChange(false);
            onAddVehicle();
          }}
        >
          <Icon name="Plus" size="sm" />
          <Text variant="label">Agregar vehículo</Text>
        </Button>
      }
      dismissible={!setActiveVehicle.isPending}
      open={open}
      onOpenChange={onOpenChange}
      title="Elegir vehículo"
    >
      <div className="flex flex-col gap-3">
        {vehicles.map((vehicle) => {
          const isActive = vehicle.id === activeVehicle?.id;

          return (
            <button
              aria-current={isActive ? 'true' : undefined}
              className={`flex min-h-20 items-center gap-3 rounded-[16px] border p-3 text-left transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 ${isActive ? 'border-primary bg-red-50 hover:bg-red-50' : 'border-border bg-card'}`}
              disabled={setActiveVehicle.isPending}
              key={vehicle.id}
              type="button"
              onClick={() => void selectVehicle(vehicle)}
            >
              <div className="grid h-14 w-20 shrink-0 place-items-center rounded-[12px] bg-neutral-100">
                <Icon color="muted" name="CarFront" size="lg" />
              </div>
              <div className="min-w-0 flex-1">
                <Text className="block truncate" variant="subheading">
                  {vehicle.brand} {vehicle.model}
                </Text>
                <Text className="mt-1 block" color="muted" variant="body">
                  {vehicle.year} · {vehicle.mileage.toLocaleString('es-AR')} km
                </Text>
              </div>
              {isActive ? (
                <Text className="shrink-0" color="primary" variant="caption-strong">
                  Activo
                </Text>
              ) : null}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
