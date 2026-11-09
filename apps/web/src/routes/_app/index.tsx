import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { HomeScheduleCard } from '@/features/home/home-schedule-card';
import { MaintenanceCard } from '@/features/maintenances/maintenance-card';
import { useMaintenanceSheet } from '@/features/maintenances/maintenance-sheet-context';
import { useMaintenances } from '@/features/maintenances/queries';
import { useSchedules } from '@/features/schedules/queries';
import { useScheduleSheet } from '@/features/schedules/schedule-sheet-context';
import { sortSchedules } from '@/features/schedules/sort-schedules';
import { useActiveVehicle } from '@/features/vehicles/queries';

export const Route = createFileRoute('/_app/')({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const schedulesQuery = useSchedules(activeVehicle?.id);
  const maintenancesQuery = useMaintenances(activeVehicle?.id);
  const { openMaintenanceDetail, openRegisterMaintenance } = useMaintenanceSheet();
  const { openScheduleDetail } = useScheduleSheet();

  function page(children: ReactNode) {
    return <PageContainer>{children}</PageContainer>;
  }

  function retryHome() {
    void Promise.all([vehiclesQuery.refetch(), currentUserQuery.refetch()]);
  }

  if (vehiclesQuery.isPending || currentUserQuery.isPending) {
    return page(<HomePageSkeleton />);
  }

  if (vehiclesQuery.isLoadingError || currentUserQuery.isLoadingError) {
    return page(
      <>
        <Text variant="title">Inicio</Text>
        <div className="mt-8">
          <EmptyState
            action={<RetryButton onRetry={retryHome} />}
            description="Revisá tu conexión y volvé a intentarlo."
            icon="TriangleAlert"
            title="No pudimos cargar Inicio"
          />
        </div>
      </>,
    );
  }

  if (!activeVehicle) {
    return page(
      <>
        <Text variant="title">Inicio</Text>
        <div className="mt-8">
          <EmptyState
            action={
              <Button className="gap-2" onClick={openRegisterMaintenance}>
                <Icon color="on-primary" name="Plus" size="sm" />
                <Text color="on-primary" variant="label">
                  Agregar vehículo
                </Text>
              </Button>
            }
            description="Agregá tu primer vehículo para ver sus próximos servicios y su historial."
            icon="CarFront"
            title="Todavía no tenés vehículos"
          />
        </div>
      </>,
    );
  }

  const schedules = sortSchedules(
    (schedulesQuery.data ?? []).filter((schedule) => schedule.status !== 'on_track'),
  );
  const recentMaintenances = [...(maintenancesQuery.data ?? [])]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    )
    .slice(0, 5);

  return (
    <PageContainer>
      <div>
        <Text variant="title">Inicio</Text>
        <Text className="mt-1" color="muted" variant="body">
          {activeVehicle.brand} {activeVehicle.model} · {activeVehicle.plate}
        </Text>
      </div>

      {vehiclesQuery.isRefetchError || currentUserQuery.isRefetchError ? (
        <RefetchError
          message="No pudimos actualizar el vehículo seleccionado."
          onRetry={retryHome}
        />
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <Text as="h2" color="muted" variant="overline">
            Próximos mantenimientos
          </Text>
          <div className="mt-3">
            {schedulesQuery.isLoadingError ? (
              <EmptyState
                action={<RetryButton onRetry={() => void schedulesQuery.refetch()} />}
                description="Revisá tu conexión y volvé a intentarlo."
                icon="TriangleAlert"
                title="No pudimos cargar los próximos mantenimientos"
              />
            ) : schedulesQuery.isPending ? (
              <MaintenanceCardsSkeleton />
            ) : (
              <>
                {schedulesQuery.isRefetchError ? (
                  <RefetchError
                    message="No pudimos actualizar los próximos mantenimientos."
                    onRetry={() => void schedulesQuery.refetch()}
                  />
                ) : null}
                {schedules.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {schedules.map((schedule) => (
                      <HomeScheduleCard
                        key={schedule.id}
                        schedule={schedule}
                        onClick={() => openScheduleDetail(schedule.id)}
                      />
                    ))}
                  </div>
                ) : schedulesQuery.isRefetchError ? null : (
                  <OnTrackState />
                )}
              </>
            )}
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <Text as="h2" color="muted" variant="overline">
              Mantenimientos recientes
            </Text>
            <Button variant="link" onClick={() => navigate({ to: '/calendario' })}>
              <Text color="primary" variant="caption-strong">
                Ver todos
              </Text>
            </Button>
          </div>
          <div className="mt-3">
            {maintenancesQuery.isLoadingError ? (
              <EmptyState
                action={<RetryButton onRetry={() => void maintenancesQuery.refetch()} />}
                description="Revisá tu conexión y volvé a intentarlo."
                icon="TriangleAlert"
                title="No pudimos cargar el historial"
              />
            ) : maintenancesQuery.isPending ? (
              <HistoryRowsSkeleton />
            ) : (
              <>
                {maintenancesQuery.isRefetchError ? (
                  <RefetchError
                    message="No pudimos actualizar el historial."
                    onRetry={() => void maintenancesQuery.refetch()}
                  />
                ) : null}
                {recentMaintenances.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {recentMaintenances.map((maintenance) => (
                      <MaintenanceCard
                        key={maintenance.id}
                        maintenance={maintenance}
                        schedules={schedulesQuery.data}
                        onClick={() => openMaintenanceDetail(maintenance.id)}
                      />
                    ))}
                  </div>
                ) : maintenancesQuery.isRefetchError ? null : (
                  <EmptyState
                    action={
                      <Button className="gap-2" onClick={openRegisterMaintenance}>
                        <Icon color="on-primary" name="Plus" size="sm" />
                        <Text color="on-primary" variant="label">
                          Registrar mantenimiento
                        </Text>
                      </Button>
                    }
                    description="Registrá el primer servicio de este vehículo y va a aparecer acá."
                    icon="Wrench"
                    title="Todavía no hay mantenimientos"
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

const SKELETON_ITEMS = ['first', 'second', 'third'] as const;

function HomePageSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <Text className="sr-only">Cargando…</Text>
      <div className="lg:col-span-7">
        <Skeleton className="h-3 w-40 rounded-full" />
        <div className="mt-3 flex flex-col gap-3">
          {SKELETON_ITEMS.map((item) => (
            <MaintenanceCardSkeleton key={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MaintenanceCardsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Text className="sr-only">Cargando…</Text>
      {SKELETON_ITEMS.map((item) => (
        <MaintenanceCardSkeleton key={item} />
      ))}
    </div>
  );
}

function MaintenanceCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/3 rounded-full" />
          <Skeleton className="h-4 w-1/2 rounded-full" />
        </div>
      </div>
      <div className="my-4 border-t border-border" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
    </div>
  );
}

function HistoryRowsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Text className="sr-only">Cargando…</Text>
      {SKELETON_ITEMS.map((item) => (
        <HistoryRowSkeleton key={item} />
      ))}
    </div>
  );
}

function HistoryRowSkeleton() {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="size-12 shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-5 w-1/2 rounded-full" />
        <Skeleton className="h-4 w-3/4 rounded-full" />
      </div>
    </div>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <Button variant="secondary" onClick={onRetry}>
      <Text variant="label">Volver a intentar</Text>
    </Button>
  );
}

function RefetchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <Text color="danger" variant="caption">
        {message}
      </Text>
      <RetryButton onRetry={onRetry} />
    </div>
  );
}

function OnTrackState() {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-border bg-card p-4">
      <Icon color="success" name="CalendarCheck2" size="md" />
      <div>
        <Text variant="body-strong">Estás al día</Text>
        <Text className="mt-1" color="muted" variant="body">
          No hay mantenimientos dentro de tus umbrales.
        </Text>
      </div>
    </div>
  );
}
