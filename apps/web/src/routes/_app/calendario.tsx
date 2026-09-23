import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MaintenanceCard } from '@/features/maintenances/maintenance-card';
import { useMaintenanceSheet } from '@/features/maintenances/maintenance-sheet-context';
import { useMaintenances } from '@/features/maintenances/queries';
import { useActiveVehicle } from '@/features/vehicles/queries';
import type { Vehicle } from '@/features/vehicles/types';

export const Route = createFileRoute('/_app/calendario')({
  component: CalendarPage,
});

function CalendarHeader({ vehicle }: { vehicle?: Vehicle }) {
  return (
    <div className="min-w-0">
      <Text variant="title">Calendario</Text>
      {vehicle ? (
        <Text className="mt-1 truncate" color="muted" variant="body">
          Mantenimientos de {vehicle.brand} {vehicle.model}
        </Text>
      ) : null}
    </div>
  );
}

function CalendarPage() {
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const maintenancesQuery = useMaintenances(activeVehicle?.id);
  const { openRegisterMaintenance } = useMaintenanceSheet();

  function page(children: ReactNode) {
    return (
      <PageContainer>
        <CalendarHeader vehicle={activeVehicle} />
        {children}
      </PageContainer>
    );
  }

  // An idle query stays pending forever, so isLoading is what tells a real fetch apart
  // from the disabled query of an account without an active vehicle.
  if (vehiclesQuery.isPending || currentUserQuery.isPending || maintenancesQuery.isLoading) {
    return page(
      <div className="grid min-h-72 place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Icon className="animate-spin" color="primary" name="Loader2" size="lg" />
          <Text color="muted" variant="body">
            Cargando historial...
          </Text>
        </div>
      </div>,
    );
  }

  // isLoadingError is the error-without-data case: a failed background refetch keeps the
  // cached list on screen instead of replacing it with the full-page error.
  if (
    vehiclesQuery.isLoadingError ||
    currentUserQuery.isLoadingError ||
    maintenancesQuery.isLoadingError
  ) {
    return page(
      <div className="mt-8">
        <EmptyState
          action={
            <Button
              variant="secondary"
              onClick={() => {
                // refetch() ignores `enabled`, so retrying without an active vehicle would
                // request /vehicles//maintenances and keep the screen stuck on the error.
                void Promise.all([
                  vehiclesQuery.refetch(),
                  currentUserQuery.refetch(),
                  ...(activeVehicle ? [maintenancesQuery.refetch()] : []),
                ]);
              }}
            >
              <Text variant="label">Volver a intentar</Text>
            </Button>
          }
          description="Revisá tu conexión y volvé a intentarlo."
          icon="TriangleAlert"
          title="No pudimos cargar el historial"
        />
      </div>,
    );
  }

  if (!activeVehicle) {
    return page(
      <div className="mt-8">
        <EmptyState
          description="El calendario se arma con los mantenimientos del vehículo seleccionado."
          icon="CalendarDays"
          title="Elegí un vehículo"
        />
      </div>,
    );
  }

  const maintenances = maintenancesQuery.data ?? [];

  if (maintenances.length === 0) {
    return page(
      <div className="mt-8">
        <EmptyState
          action={
            <Button className="gap-2" onClick={openRegisterMaintenance}>
              <Icon color="on-primary" name="Plus" size="sm" />
              <Text color="on-primary" variant="label">
                Registrar mantenimiento
              </Text>
            </Button>
          }
          description="Registrá el primer servicio de este vehículo para empezar su historial."
          icon="Wrench"
          title="Sin mantenimientos"
        />
      </div>,
    );
  }

  return page(
    <section className="mt-8">
      <Text as="h2" className="px-1" color="muted" variant="overline">
        Historial completo
      </Text>
      <div className="mt-3 flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
        {maintenances.map((maintenance) => (
          <MaintenanceCard key={maintenance.id} maintenance={maintenance} />
        ))}
      </div>
    </section>,
  );
}
