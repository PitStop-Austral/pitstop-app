import { useState } from 'react';

import { ActiveVehicleButton } from './active-vehicle-button';
import { useActiveVehicle } from './queries';
import { VehicleFormSheet } from './vehicle-form-sheet';
import { VehiclePickerSheet } from './vehicle-picker-sheet';

type VehiclePickerProps = {
  className?: string;
  compact?: boolean;
};

export function VehiclePicker({ className, compact = false }: VehiclePickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const isLoading = vehiclesQuery.isPending || currentUserQuery.isPending;
  const hasError = vehiclesQuery.isError || currentUserQuery.isError;

  function openPicker() {
    if (!activeVehicle) {
      setIsFormOpen(true);
      return;
    }
    setIsPickerOpen(true);
  }

  return (
    <>
      <ActiveVehicleButton
        activeVehicle={activeVehicle}
        className={className}
        compact={compact}
        disabled={hasError}
        isLoading={isLoading}
        onClick={openPicker}
      />
      <VehiclePickerSheet
        activeVehicle={activeVehicle}
        open={isPickerOpen}
        vehicles={vehiclesQuery.data ?? []}
        onAddVehicle={() => setIsFormOpen(true)}
        onOpenChange={setIsPickerOpen}
      />
      <VehicleFormSheet mode="add" open={isFormOpen} onOpenChange={setIsFormOpen} />
    </>
  );
}
