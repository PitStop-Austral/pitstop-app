import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { useMaintenanceSheet } from '@/features/maintenances/maintenance-sheet-context';
import { useActiveVehicle } from '@/features/vehicles/queries';
import { DeleteScheduleConfirmSheet } from './delete-schedule-confirm-sheet';
import { useSchedules } from './queries';
import { ScheduleDetailSheet } from './schedule-detail-sheet';
import { ScheduleFormSheet } from './schedule-form-sheet';
import type { Schedule } from './types';

type ScheduleSheetContextValue = {
  openCreateSchedule: () => void;
  openScheduleDetail: (scheduleId: string) => void;
};

type OpenScheduleSheet =
  | { type: 'create' }
  | { type: 'detail'; id: string }
  | { type: 'edit'; schedule: Schedule }
  | { type: 'delete'; schedule: Schedule }
  | null;

const ScheduleSheetContext = createContext<ScheduleSheetContextValue | null>(null);

export function ScheduleSheetProvider({ children }: { children: ReactNode }) {
  const [openSheet, setOpenSheet] = useState<OpenScheduleSheet>(null);
  const { activeVehicle } = useActiveVehicle();
  const { openRegisterMaintenance } = useMaintenanceSheet();
  const schedulesQuery = useSchedules(activeVehicle?.id);
  const closeOnDismiss = useCallback((open: boolean) => {
    if (!open) setOpenSheet(null);
  }, []);

  function openCreateSchedule() {
    if (!activeVehicle || !schedulesQuery.data) return;
    setOpenSheet({ type: 'create' });
  }

  function openScheduleDetail(id: string) {
    if (!activeVehicle) return;
    setOpenSheet({ type: 'detail', id });
  }

  return (
    <ScheduleSheetContext.Provider value={{ openCreateSchedule, openScheduleDetail }}>
      {children}
      {openSheet?.type === 'create' && activeVehicle && schedulesQuery.data ? (
        <ScheduleFormSheet
          existingTypes={schedulesQuery.data.map((schedule) => schedule.type)}
          open
          vehicle={activeVehicle}
          onOpenChange={closeOnDismiss}
        />
      ) : null}
      {openSheet?.type === 'detail' && activeVehicle ? (
        <ScheduleDetailSheet
          scheduleId={openSheet.id}
          vehicleId={activeVehicle.id}
          onDelete={(schedule) => setOpenSheet({ type: 'delete', schedule })}
          onEdit={(schedule) => setOpenSheet({ type: 'edit', schedule })}
          onOpenChange={closeOnDismiss}
          onRegisterCompleted={(schedule) => {
            setOpenSheet(null);
            openRegisterMaintenance({ serviceType: schedule.type });
          }}
        />
      ) : null}
      {openSheet?.type === 'edit' && activeVehicle && schedulesQuery.data ? (
        <ScheduleFormSheet
          existingTypes={schedulesQuery.data.map((schedule) => schedule.type)}
          open
          schedule={openSheet.schedule}
          vehicle={activeVehicle}
          onOpenChange={closeOnDismiss}
        />
      ) : null}
      {openSheet?.type === 'delete' ? (
        <DeleteScheduleConfirmSheet
          open
          schedule={openSheet.schedule}
          onOpenChange={closeOnDismiss}
        />
      ) : null}
    </ScheduleSheetContext.Provider>
  );
}

export function useScheduleSheet(): ScheduleSheetContextValue {
  const context = useContext(ScheduleSheetContext);
  if (!context) {
    throw new Error('useScheduleSheet must be used within ScheduleSheetProvider');
  }
  return context;
}
