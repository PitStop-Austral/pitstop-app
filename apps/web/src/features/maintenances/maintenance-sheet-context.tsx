import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { useActiveVehicle } from '@/features/vehicles/queries';
import { VehicleFormSheet } from '@/features/vehicles/vehicle-form-sheet';
import { DeleteMaintenanceConfirmSheet } from './delete-maintenance-confirm-sheet';
import { MaintenanceDetailSheet } from './maintenance-detail-sheet';
import { MaintenanceFormSheet } from './maintenance-form-sheet';
import type { Maintenance } from './types';

type MaintenanceSheetContextValue = {
  openRegisterMaintenance: () => void;
  openMaintenanceDetail: (maintenanceId: string) => void;
  canRegister: boolean;
  isDisabled: boolean;
};

// A single state so only one sheet is ever open: moving from the detail to edit or delete
// replaces it instead of stacking dialogs.
type OpenSheet =
  | { type: 'register' }
  | { type: 'vehicle' }
  | { type: 'detail'; id: string }
  | { type: 'edit'; maintenance: Maintenance }
  | { type: 'delete'; maintenance: Maintenance }
  | null;

const MaintenanceSheetContext = createContext<MaintenanceSheetContextValue | null>(null);

type MaintenanceSheetProviderProps = {
  children: ReactNode;
};

export function MaintenanceSheetProvider({ children }: MaintenanceSheetProviderProps) {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const isDisabled =
    vehiclesQuery.isPending ||
    currentUserQuery.isPending ||
    vehiclesQuery.isError ||
    currentUserQuery.isError;

  function openRegisterMaintenance() {
    if (isDisabled) return;
    setOpenSheet({ type: activeVehicle ? 'register' : 'vehicle' });
  }

  function openMaintenanceDetail(id: string) {
    setOpenSheet({ type: 'detail', id });
  }

  // Stable because the detail sheet closes itself from an effect that depends on it.
  const closeOnDismiss = useCallback((open: boolean) => {
    if (!open) setOpenSheet(null);
  }, []);

  return (
    <MaintenanceSheetContext.Provider
      value={{
        openRegisterMaintenance,
        openMaintenanceDetail,
        canRegister: Boolean(activeVehicle),
        isDisabled,
      }}
    >
      {children}
      {openSheet?.type === 'register' && activeVehicle ? (
        <MaintenanceFormSheet open vehicle={activeVehicle} onOpenChange={closeOnDismiss} />
      ) : null}
      {openSheet?.type === 'detail' && activeVehicle ? (
        <MaintenanceDetailSheet
          maintenanceId={openSheet.id}
          vehicleId={activeVehicle.id}
          onDelete={(maintenance) => setOpenSheet({ type: 'delete', maintenance })}
          onEdit={(maintenance) => setOpenSheet({ type: 'edit', maintenance })}
          onOpenChange={closeOnDismiss}
        />
      ) : null}
      {openSheet?.type === 'edit' && activeVehicle ? (
        <MaintenanceFormSheet
          open
          maintenance={openSheet.maintenance}
          vehicle={activeVehicle}
          onOpenChange={closeOnDismiss}
        />
      ) : null}
      {openSheet?.type === 'delete' ? (
        <DeleteMaintenanceConfirmSheet
          open
          maintenance={openSheet.maintenance}
          onOpenChange={closeOnDismiss}
        />
      ) : null}
      {openSheet?.type === 'vehicle' ? (
        <VehicleFormSheet mode="add" open onOpenChange={closeOnDismiss} />
      ) : null}
    </MaintenanceSheetContext.Provider>
  );
}

export function useMaintenanceSheet(): MaintenanceSheetContextValue {
  const context = useContext(MaintenanceSheetContext);
  if (!context) {
    throw new Error('useMaintenanceSheet must be used within MaintenanceSheetProvider');
  }
  return context;
}
