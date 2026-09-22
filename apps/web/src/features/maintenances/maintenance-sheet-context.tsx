import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { useActiveVehicle } from '@/features/vehicles/queries';
import { VehicleFormSheet } from '@/features/vehicles/vehicle-form-sheet';
import { MaintenanceFormSheet } from './maintenance-form-sheet';

type MaintenanceSheetContextValue = {
  openRegisterMaintenance: () => void;
  canRegister: boolean;
  isDisabled: boolean;
};

const MaintenanceSheetContext = createContext<MaintenanceSheetContextValue | null>(null);

type MaintenanceSheetProviderProps = {
  children: ReactNode;
};

export function MaintenanceSheetProvider({ children }: MaintenanceSheetProviderProps) {
  const [openSheet, setOpenSheet] = useState<'maintenance' | 'vehicle' | null>(null);
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const isDisabled =
    vehiclesQuery.isPending ||
    currentUserQuery.isPending ||
    vehiclesQuery.isError ||
    currentUserQuery.isError;

  function openRegisterMaintenance() {
    if (isDisabled) return;
    setOpenSheet(activeVehicle ? 'maintenance' : 'vehicle');
  }

  return (
    <MaintenanceSheetContext.Provider
      value={{ openRegisterMaintenance, canRegister: Boolean(activeVehicle), isDisabled }}
    >
      {children}
      {openSheet === 'maintenance' && activeVehicle ? (
        <MaintenanceFormSheet
          open
          vehicle={activeVehicle}
          onOpenChange={(open) => setOpenSheet(open ? 'maintenance' : null)}
        />
      ) : null}
      {openSheet === 'vehicle' ? (
        <VehicleFormSheet
          mode="add"
          open
          onOpenChange={(open) => setOpenSheet(open ? 'vehicle' : null)}
        />
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
