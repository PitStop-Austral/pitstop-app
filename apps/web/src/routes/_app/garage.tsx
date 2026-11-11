import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { MileageEvolutionCard } from '@/components/garage/mileage-evolution-card';
import { VehicleHeroCard } from '@/components/garage/vehicle-hero-card';
import { VehicleInformationPanel } from '@/components/garage/vehicle-information-panel';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import {
  resolveMaintenanceAlertTarget,
  resolveMileageReminderTarget,
} from '@/features/notifications/notification-message';
import { useSchedules } from '@/features/schedules/queries';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import { useScheduleSheet } from '@/features/schedules/schedule-sheet-context';
import { sortSchedules } from '@/features/schedules/sort-schedules';
import { DeleteVehicleConfirmSheet } from '@/features/vehicles/delete-vehicle-confirm-sheet';
import { useActiveVehicle, useSetActiveVehicle } from '@/features/vehicles/queries';
import { UpdateMileageSheet } from '@/features/vehicles/update-mileage-sheet';
import { VehicleFormSheet } from '@/features/vehicles/vehicle-form-sheet';
import { WishlistPanel } from '@/features/wishlist/wishlist-panel';

const GARAGE_TABS = ['info', 'recomendados', 'deseos'] as const;
type GarageTab = (typeof GARAGE_TABS)[number];
type GarageSearch = {
  tab: GarageTab;
  vehicleId?: string;
  scheduleId?: string;
  action?: 'update-mileage';
};

function optionalSearchString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export const Route = createFileRoute('/_app/garage')({
  validateSearch: (search: Record<string, unknown>): GarageSearch => ({
    tab: GARAGE_TABS.includes(search.tab as GarageTab) ? (search.tab as GarageTab) : 'info',
    vehicleId: optionalSearchString(search.vehicleId),
    scheduleId: optionalSearchString(search.scheduleId),
    action: search.action === 'update-mileage' ? 'update-mileage' : undefined,
  }),
  component: GaragePage,
});

function GaragePage() {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mileageOpen, setMileageOpen] = useState(false);
  const {
    tab,
    vehicleId: targetVehicleId,
    scheduleId: targetScheduleId,
    action: targetAction,
  } = Route.useSearch();
  const navigate = useNavigate();
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const { mutateAsync: setActiveVehicle } = useSetActiveVehicle();
  const schedulesQuery = useSchedules(activeVehicle?.id);
  const { refetch: refetchSchedules } = schedulesQuery;
  const { refetch: refetchVehicles } = vehiclesQuery;
  const { openCreateSchedule, openScheduleDetail } = useScheduleSheet();
  const switchingDestination = useRef<string | undefined>(undefined);
  const handledDestination = useRef<string | undefined>(undefined);
  const refreshedVehiclesDestination = useRef<string | undefined>(undefined);
  const refreshedSchedulesDestination = useRef<string | undefined>(undefined);
  const switchingMileageDestination = useRef<string | undefined>(undefined);
  const handledMileageDestination = useRef<string | undefined>(undefined);
  const refreshedMileageDestination = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!targetVehicleId || !targetScheduleId) {
      switchingDestination.current = undefined;
      handledDestination.current = undefined;
      refreshedVehiclesDestination.current = undefined;
      refreshedSchedulesDestination.current = undefined;
      return;
    }
    if (vehiclesQuery.isPending || currentUserQuery.isPending) return;

    const destinationKey = `${targetVehicleId}:${targetScheduleId}`;
    if (handledDestination.current === destinationKey) return;
    if (refreshedVehiclesDestination.current !== destinationKey) {
      refreshedVehiclesDestination.current = destinationKey;
      void refetchVehicles();
      return;
    }
    if (vehiclesQuery.isFetching) return;
    if (
      activeVehicle?.id === targetVehicleId &&
      refreshedSchedulesDestination.current !== destinationKey
    ) {
      refreshedSchedulesDestination.current = destinationKey;
      void refetchSchedules();
      return;
    }
    const clearDestination = () =>
      navigate({
        to: '/garage',
        search: { tab: 'recomendados' },
        replace: true,
        resetScroll: false,
      });

    const resolution = resolveMaintenanceAlertTarget(
      activeVehicle?.id,
      vehiclesQuery.data,
      schedulesQuery.isError ? [] : schedulesQuery.data,
      targetVehicleId,
      targetScheduleId,
      vehiclesQuery.isFetching || schedulesQuery.isFetching,
    );
    if (resolution.kind === 'waiting') return;
    if (resolution.kind === 'invalid') {
      switchingDestination.current = undefined;
      handledDestination.current = destinationKey;
      void clearDestination();
      toast.error('No encontramos esa frecuencia');
      return;
    }
    if (resolution.kind === 'switch-vehicle') {
      if (switchingDestination.current === destinationKey) return;
      switchingDestination.current = destinationKey;
      void setActiveVehicle(resolution.vehicleId).catch(async () => {
        switchingDestination.current = undefined;
        await clearDestination();
        toast.error('No encontramos esa frecuencia');
      });
      return;
    }

    switchingDestination.current = undefined;
    handledDestination.current = destinationKey;
    void clearDestination();
    openScheduleDetail(targetScheduleId);
  }, [
    activeVehicle?.id,
    currentUserQuery.isPending,
    navigate,
    openScheduleDetail,
    refetchSchedules,
    refetchVehicles,
    schedulesQuery.data,
    schedulesQuery.isError,
    schedulesQuery.isFetching,
    setActiveVehicle,
    targetScheduleId,
    targetVehicleId,
    vehiclesQuery.data,
    vehiclesQuery.isFetching,
    vehiclesQuery.isPending,
  ]);

  useEffect(() => {
    if (targetAction !== 'update-mileage' || !targetVehicleId) {
      switchingMileageDestination.current = undefined;
      handledMileageDestination.current = undefined;
      refreshedMileageDestination.current = undefined;
      return;
    }
    if (vehiclesQuery.isPending || currentUserQuery.isPending) return;

    const destinationKey = `${targetVehicleId}:update-mileage`;
    if (handledMileageDestination.current === destinationKey) return;
    if (refreshedMileageDestination.current !== destinationKey) {
      refreshedMileageDestination.current = destinationKey;
      void refetchVehicles();
      return;
    }
    if (vehiclesQuery.isFetching) return;

    const clearDestination = () =>
      navigate({
        to: '/garage',
        search: { tab: 'info' },
        replace: true,
        resetScroll: false,
      });
    const resolution = resolveMileageReminderTarget(
      activeVehicle?.id,
      vehiclesQuery.data,
      targetVehicleId,
      vehiclesQuery.isFetching,
    );
    if (resolution.kind === 'waiting') return;
    if (resolution.kind === 'invalid') {
      switchingMileageDestination.current = undefined;
      handledMileageDestination.current = destinationKey;
      void clearDestination();
      toast.error('No encontramos ese vehículo');
      return;
    }
    if (resolution.kind === 'switch-vehicle') {
      if (switchingMileageDestination.current === destinationKey) return;
      switchingMileageDestination.current = destinationKey;
      void setActiveVehicle(resolution.vehicleId).catch(async () => {
        switchingMileageDestination.current = undefined;
        await clearDestination();
        toast.error('No encontramos ese vehículo');
      });
      return;
    }

    switchingMileageDestination.current = undefined;
    handledMileageDestination.current = destinationKey;
    void clearDestination();
    setMileageOpen(true);
  }, [
    activeVehicle?.id,
    currentUserQuery.isPending,
    navigate,
    refetchVehicles,
    setActiveVehicle,
    targetAction,
    targetVehicleId,
    vehiclesQuery.data,
    vehiclesQuery.isFetching,
    vehiclesQuery.isPending,
  ]);

  if (vehiclesQuery.isPending || currentUserQuery.isPending) {
    return (
      <PageContainer>
        <Text variant="title">Garage</Text>
        <GaragePageSkeleton />
      </PageContainer>
    );
  }

  if (vehiclesQuery.isError || currentUserQuery.isError) {
    return (
      <PageContainer>
        <Text variant="title">Garage</Text>
        <div className="mt-8">
          <EmptyState
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  // refetch() ignores `enabled`, so without an active vehicle it would
                  // request /vehicles//schedules.
                  void Promise.all([
                    vehiclesQuery.refetch(),
                    currentUserQuery.refetch(),
                    ...(activeVehicle ? [schedulesQuery.refetch()] : []),
                  ]);
                }}
              >
                <Text variant="label">Volver a intentar</Text>
              </Button>
            }
            description="Revisá tu conexión y volvé a intentarlo."
            icon="TriangleAlert"
            title="No pudimos cargar tu garage"
          />
        </div>
      </PageContainer>
    );
  }

  if (!activeVehicle) {
    return (
      <PageContainer>
        <Text variant="title">Garage</Text>
        <div className="mt-8">
          <EmptyState
            action={
              <Button className="gap-2" onClick={() => setFormMode('add')}>
                <Icon color="on-primary" name="Plus" size="sm" />
                <Text color="on-primary" variant="label">
                  Crear vehículo
                </Text>
              </Button>
            }
            description="Creá tu primer vehículo para empezar a registrar sus mantenimientos."
            icon="Car"
            title="Tu garage está vacío"
          />
        </div>
        {formMode === 'add' ? (
          <VehicleFormSheet mode="add" open onOpenChange={() => setFormMode(null)} />
        ) : null}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Text variant="title">Garage</Text>
          <Text className="mt-1 truncate" color="muted" variant="body">
            {activeVehicle.brand} {activeVehicle.model} · {activeVehicle.plate}
          </Text>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Abrir acciones del vehículo"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card shadow-sm outline-none transition hover:border-neutral-400 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Icon name="EllipsisVertical" size="md" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFormMode('add')}>
              <Icon name="Plus" size="sm" />
              <Text variant="label">Agregar vehículo</Text>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFormMode('edit')}>
              <Icon name="Pencil" size="sm" />
              <Text variant="label">Editar</Text>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
              <Icon color="danger" name="Trash2" size="sm" />
              <Text color="danger" variant="label">
                Eliminar
              </Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <VehicleHeroCard vehicle={activeVehicle} onUpdateMileage={() => setMileageOpen(true)} />
          <MileageEvolutionCard
            key={activeVehicle.id}
            vehicleId={activeVehicle.id}
            onUpdateMileage={() => setMileageOpen(true)}
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(next) =>
            navigate({
              to: '/garage',
              search: { tab: next as GarageTab },
              replace: true,
              resetScroll: false,
            })
          }
        >
          <TabsList className="sticky top-0 z-10 bg-background/92 pt-3 backdrop-blur-xl">
            <TabsTrigger icon="Info" value="info">
              Información
            </TabsTrigger>
            <TabsTrigger icon="ThumbsUp" value="recomendados">
              Recomendados
            </TabsTrigger>
            <TabsTrigger icon="Heart" value="deseos">
              Deseos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <VehicleInformationPanel vehicle={activeVehicle} />
          </TabsContent>
          <TabsContent value="recomendados">
            <div className="mt-4 mb-3 flex justify-end">
              <Button
                className="gap-2"
                disabled={schedulesQuery.isPending || schedulesQuery.isLoadingError}
                onClick={openCreateSchedule}
              >
                <Icon color="on-primary" name="Plus" size="sm" />
                <Text color="on-primary" variant="label">
                  Nueva frecuencia
                </Text>
              </Button>
            </div>
            {schedulesQuery.isLoadingError ? (
              <EmptyState
                action={
                  <Button variant="secondary" onClick={() => void schedulesQuery.refetch()}>
                    <Text variant="label">Volver a intentar</Text>
                  </Button>
                }
                description="Revisá tu conexión y volvé a intentarlo."
                icon="TriangleAlert"
                title="No pudimos cargar las frecuencias"
              />
            ) : null}
            {schedulesQuery.isRefetchError ? (
              <div className="mb-3 flex items-center gap-3">
                <Text color="danger" variant="caption">
                  No pudimos actualizar las frecuencias.
                </Text>
                <Button variant="secondary" onClick={() => void schedulesQuery.refetch()}>
                  <Text variant="label">Volver a intentar</Text>
                </Button>
              </div>
            ) : null}
            {schedulesQuery.isPending ? <ScheduleRowsSkeleton /> : null}
            {schedulesQuery.data?.length === 0 ? (
              <EmptyState
                action={
                  <Button className="gap-2" onClick={openCreateSchedule}>
                    <Icon color="on-primary" name="Plus" size="sm" />
                    <Text color="on-primary" variant="label">
                      Crear frecuencia
                    </Text>
                  </Button>
                }
                description="Definí cada cuántos kilómetros o meses repetir un servicio y te avisamos cuando se acerque o se venza."
                icon="CalendarClock"
                title="Todavía no tenés frecuencias"
              />
            ) : null}
            {schedulesQuery.data?.length ? (
              <div className="grid grid-cols-1 gap-3 min-[1360px]:grid-cols-2">
                {sortSchedules(schedulesQuery.data).map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onClick={() => openScheduleDetail(schedule.id)}
                  />
                ))}
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="deseos">
            <WishlistPanel vehicleId={activeVehicle.id} />
          </TabsContent>
        </Tabs>
      </div>

      {formMode === 'add' ? (
        <VehicleFormSheet mode="add" open onOpenChange={() => setFormMode(null)} />
      ) : formMode === 'edit' ? (
        <VehicleFormSheet
          mode="edit"
          open
          vehicle={activeVehicle}
          onOpenChange={() => setFormMode(null)}
        />
      ) : null}
      <DeleteVehicleConfirmSheet
        open={deleteOpen}
        vehicle={activeVehicle}
        onOpenChange={setDeleteOpen}
      />
      {mileageOpen ? (
        <UpdateMileageSheet open vehicle={activeVehicle} onOpenChange={setMileageOpen} />
      ) : null}
    </PageContainer>
  );
}

const SCHEDULE_SKELETON_ITEMS = ['first', 'second', 'third'] as const;

function GaragePageSkeleton() {
  return (
    <div
      aria-busy="true"
      className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start"
    >
      <Text className="sr-only">Cargando…</Text>
      <div className="rounded-[20px] border border-border bg-card p-4">
        <Skeleton className="aspect-video w-full rounded-xl lg:aspect-[4/3]" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-6 w-1/2 rounded-full" />
          <Skeleton className="h-5 w-2/3 rounded-full" />
          <Skeleton className="mt-2 h-7 w-28 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      </div>

      <div className="hidden lg:block">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="mt-4 flex flex-col gap-3">
          {SCHEDULE_SKELETON_ITEMS.slice(0, 2).map((item) => (
            <ScheduleRowSkeleton key={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleRowsSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-3 min-[1360px]:grid-cols-2">
      <Text className="sr-only">Cargando…</Text>
      {SCHEDULE_SKELETON_ITEMS.map((item) => (
        <ScheduleRowSkeleton key={item} />
      ))}
    </div>
  );
}

function ScheduleRowSkeleton() {
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
