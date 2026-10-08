import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useActiveVehicle } from '@/features/vehicles/queries';
import { VehicleFormSheet } from '@/features/vehicles/vehicle-form-sheet';
import { NotificationPermissionSheet } from '@/features/notifications/notification-permission-sheet';
import { DeleteMaintenanceConfirmSheet } from './delete-maintenance-confirm-sheet';
import { MaintenanceDetailSheet } from './maintenance-detail-sheet';
import { MaintenanceFormSheet } from './maintenance-form-sheet';
import type { Maintenance } from './types';
import type { MaintenanceCreated } from './types';

type MaintenanceSheetContextValue = {
  openRegisterMaintenance: () => void;
  openRegisterMaintenanceForSchedule: (serviceType: string) => void;
  openMaintenanceDetail: (maintenanceId: string) => void;
  canRegister: boolean;
  isDisabled: boolean;
};

// A single state so only one sheet is ever open: moving from the detail to edit or delete
// replaces it instead of stacking dialogs.
type OpenSheet =
  | { type: 'register'; defaultServiceType?: string }
  | { type: 'vehicle' }
  | { type: 'detail'; id: string }
  | { type: 'edit'; maintenance: Maintenance }
  | { type: 'delete'; maintenance: Maintenance }
  | { type: 'notification-permission' }
  | null;

const MaintenanceSheetContext = createContext<MaintenanceSheetContextValue | null>(null);

type MaintenanceSheetProviderProps = {
  children: ReactNode;
};

export function MaintenanceSheetProvider({ children }: MaintenanceSheetProviderProps) {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const notificationDismissed = useRef(false);
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const isDisabled =
    vehiclesQuery.isPending ||
    currentUserQuery.isPending ||
    vehiclesQuery.isError ||
    currentUserQuery.isError;

  function openRegistration(defaultServiceType?: string) {
    if (isDisabled) return;
    setOpenSheet(activeVehicle ? { type: 'register', defaultServiceType } : { type: 'vehicle' });
  }

  function openRegisterMaintenance() {
    openRegistration();
  }

  function openRegisterMaintenanceForSchedule(serviceType: string) {
    openRegistration(serviceType);
  }

  function openMaintenanceDetail(id: string) {
    setOpenSheet({ type: 'detail', id });
  }

  // Stable because the detail sheet closes itself from an effect that depends on it.
  const closeOnDismiss = useCallback((open: boolean) => {
    if (!open) setOpenSheet(null);
  }, []);

  function handleCreated(maintenance: MaintenanceCreated): void {
    if (
      maintenance.isFirstMaintenance &&
      currentUserQuery.data?.notificationPromptShownAt == null &&
      !notificationDismissed.current
    ) {
      setOpenSheet({ type: 'notification-permission' });
    }
  }

  function closeNotificationPermission(open: boolean): void {
    if (open) return;
    notificationDismissed.current = true;
    setOpenSheet(null);
  }

  return (
    <MaintenanceSheetContext.Provider
      value={{
        openRegisterMaintenance,
        openRegisterMaintenanceForSchedule,
        openMaintenanceDetail,
        canRegister: Boolean(activeVehicle),
        isDisabled,
      }}
    >
      {children}
      {openSheet?.type === 'register' && activeVehicle ? (
        <MaintenanceFormSheet
          defaultServiceType={openSheet.defaultServiceType}
          open
          vehicle={activeVehicle}
          onCreated={handleCreated}
          onOpenChange={closeOnDismiss}
        />
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
      {openSheet?.type === 'notification-permission' ? (
        <NotificationPermissionSheet open onOpenChange={closeNotificationPermission} />
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
