import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { DayMaintenanceSheet } from '@/features/calendar/day-maintenance-sheet';
import { toCalendarEvents } from '@/features/calendar/calendar-events';
import { MonthlyCalendar } from '@/features/calendar/monthly-calendar';
import type { CalendarEvent } from '@/features/calendar/types';
import {
  filterAndSortMaintenances,
  HISTORY_CATEGORIES,
  HISTORY_PAGE_SIZE,
  HISTORY_SORTS,
  paginateHistory,
} from '@/features/maintenances/history-controls';
import type { HistoryCategory, HistorySort } from '@/features/maintenances/history-controls';
import { MaintenanceCard } from '@/features/maintenances/maintenance-card';
import { getArgentinaDateValue } from '@/features/maintenances/maintenance-form-schema';
import { useMaintenanceSheet } from '@/features/maintenances/maintenance-sheet-context';
import { useMaintenances } from '@/features/maintenances/queries';
import { useSchedules } from '@/features/schedules/queries';
import { useScheduleSheet } from '@/features/schedules/schedule-sheet-context';
import { useActiveVehicle } from '@/features/vehicles/queries';
import type { Vehicle } from '@/features/vehicles/types';

export const Route = createFileRoute('/_app/calendario')({
  component: CalendarPage,
});

const CATEGORY_LABELS: Record<HistoryCategory, string> = {
  TODOS: 'Todos',
  MANTENIMIENTO: 'Mantenimiento',
  ARREGLO: 'Arreglo',
};

const SORT_LABELS: Record<HistorySort, string> = {
  date: 'Fecha',
  mileage: 'Kilometraje',
  cost: 'Costo',
};

type CalendarSelection = {
  userId: string;
  vehicleId: string;
  date: string;
};

type PendingDetail = {
  userId: string;
  vehicleId: string;
  event: CalendarEvent;
};

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

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <Button variant="secondary" onClick={onRetry}>
      <Text variant="label">Volver a intentar</Text>
    </Button>
  );
}

// A failed background refetch keeps the cached data on screen and only flags it here.
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

function CalendarPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<HistoryCategory>('TODOS');
  const [sort, setSort] = useState<HistorySort>('date');
  const [historyPages, setHistoryPages] = useState(1);
  const [firstNewMaintenanceIndex, setFirstNewMaintenanceIndex] = useState<number | null>(null);
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [pendingDetail, setPendingDetail] = useState<PendingDetail | null>(null);
  const [headerFocusRequest, setHeaderFocusRequest] = useState(0);
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const maintenancesQuery = useMaintenances(activeVehicle?.id);
  const schedulesQuery = useSchedules(activeVehicle?.id);
  const { openMaintenanceDetail, openRegisterMaintenance } = useMaintenanceSheet();
  const { openScheduleDetail } = useScheduleSheet();
  const firstNewMaintenanceRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSelection(null);
    setPendingDetail(null);
  }, [activeVehicle?.id, currentUserQuery.data?.id]);

  useEffect(() => {
    setHistoryPages(1);
    setFirstNewMaintenanceIndex(null);
  }, [activeVehicle?.id]);

  useEffect(() => {
    if (firstNewMaintenanceIndex === null) return;

    firstNewMaintenanceRef.current?.focus();
    setFirstNewMaintenanceIndex(null);
  }, [firstNewMaintenanceIndex, historyPages]);

  useEffect(() => {
    if (!pendingDetail) return;
    if (
      pendingDetail.vehicleId !== activeVehicle?.id ||
      pendingDetail.userId !== currentUserQuery.data?.id
    ) {
      setPendingDetail(null);
      return;
    }

    setPendingDetail(null);
    if (pendingDetail.event.source === 'maintenance') {
      openMaintenanceDetail(pendingDetail.event.maintenance.id);
    } else {
      openScheduleDetail(pendingDetail.event.schedule.id);
    }
  }, [
    activeVehicle?.id,
    currentUserQuery.data?.id,
    openMaintenanceDetail,
    openScheduleDetail,
    pendingDetail,
  ]);

  const userId = currentUserQuery.data?.id;
  const selectedDate =
    selection && selection.vehicleId === activeVehicle?.id && selection.userId === userId
      ? selection.date
      : undefined;
  const eventsByDate =
    maintenancesQuery.data && schedulesQuery.data
      ? toCalendarEvents(maintenancesQuery.data, schedulesQuery.data)
      : null;
  const selectedEvents = selectedDate && eventsByDate ? (eventsByDate.get(selectedDate) ?? []) : [];
  const daySheetOpen = selectedDate != null && eventsByDate != null;

  useEffect(() => {
    if (!daySheetOpen || selectedEvents.length > 0) return;
    setSelection(null);
    setHeaderFocusRequest((request) => request + 1);
    toast.info('Ya no hay mantenimientos para este día');
  }, [daySheetOpen, selectedEvents.length]);

  function handleSelectEvent(event: CalendarEvent) {
    if (!activeVehicle || !userId) return;
    setPendingDetail({ event, userId, vehicleId: activeVehicle.id });
    setSelection(null);
  }

  function page(children: ReactNode) {
    return (
      <PageContainer>
        <CalendarHeader vehicle={activeVehicle} />
        {children}
      </PageContainer>
    );
  }

  if (vehiclesQuery.isPending || currentUserQuery.isPending) {
    return page(
      <div className="mt-8">
        <CalendarSkeleton />
      </div>,
    );
  }

  // isLoadingError is the error-without-data case: a failed background refetch keeps the
  // cached data on screen instead of replacing it with the full-page error.
  if (vehiclesQuery.isLoadingError || currentUserQuery.isLoadingError) {
    return page(
      <div className="mt-8">
        <EmptyState
          action={
            <RetryButton
              onRetry={() => {
                void Promise.all([vehiclesQuery.refetch(), currentUserQuery.refetch()]);
              }}
            />
          }
          description="Revisá tu conexión y volvé a intentarlo."
          icon="TriangleAlert"
          title="No pudimos cargar el calendario"
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

  // Both queries are enabled from here on, so refetch() always targets the active vehicle.
  const retryCalendar = () => {
    void Promise.all([
      ...(maintenancesQuery.isError ? [maintenancesQuery.refetch()] : []),
      ...(schedulesQuery.isError ? [schedulesQuery.refetch()] : []),
    ]);
  };
  const today = getArgentinaDateValue();

  let calendar: ReactNode;
  if (maintenancesQuery.isLoadingError || schedulesQuery.isLoadingError) {
    calendar = (
      <EmptyState
        action={<RetryButton onRetry={retryCalendar} />}
        description="Revisá tu conexión y volvé a intentarlo."
        icon="TriangleAlert"
        title="No pudimos cargar el calendario"
      />
    );
  } else if (!maintenancesQuery.data || !schedulesQuery.data) {
    calendar = <CalendarSkeleton />;
  } else if (!eventsByDate) {
    calendar = <CalendarSkeleton />;
  } else {
    calendar = (
      <>
        {maintenancesQuery.isRefetchError || schedulesQuery.isRefetchError ? (
          <RefetchError message="No pudimos actualizar el calendario." onRetry={retryCalendar} />
        ) : null}
        <MonthlyCalendar
          eventsByDate={eventsByDate}
          focusHeaderRequest={headerFocusRequest}
          selectedDate={selectedDate}
          today={today}
          onSelectDate={(date) => {
            if (!userId) return;
            setSelection({ userId, vehicleId: activeVehicle.id, date });
          }}
        />
      </>
    );
  }

  const maintenances = maintenancesQuery.data ?? [];
  const visibleMaintenances = filterAndSortMaintenances(maintenances, { search, category, sort });
  const paginatedMaintenances = paginateHistory(
    visibleMaintenances,
    historyPages,
    HISTORY_PAGE_SIZE,
  );

  const clearFilters = () => {
    setSearch('');
    setCategory('TODOS');
    setSort('date');
    setHistoryPages(1);
    setFirstNewMaintenanceIndex(null);
  };

  let history: ReactNode;
  if (maintenancesQuery.isLoadingError) {
    history = (
      <EmptyState
        action={<RetryButton onRetry={() => void maintenancesQuery.refetch()} />}
        description="Revisá tu conexión y volvé a intentarlo."
        icon="TriangleAlert"
        title="No pudimos cargar el historial"
      />
    );
  } else if (maintenancesQuery.isPending) {
    history = <CalendarHistorySkeleton />;
  } else if (maintenances.length === 0) {
    history = (
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
    );
  } else {
    history = (
      <>
        {maintenancesQuery.isRefetchError ? (
          <RefetchError
            message="No pudimos actualizar el historial."
            onRetry={() => void maintenancesQuery.refetch()}
          />
        ) : null}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Icon
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
              color="muted"
              name="Search"
              size="sm"
            />
            <Input
              aria-label="Buscar en el historial"
              className="pl-11"
              placeholder="Buscar en el historial"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setHistoryPages(1);
                setFirstNewMaintenanceIndex(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex flex-wrap gap-2">
              {HISTORY_CATEGORIES.map((option) => {
                const selected = option === category;
                return (
                  <Button
                    key={option}
                    aria-pressed={selected}
                    variant={selected ? 'primary' : 'secondary'}
                    onClick={() => {
                      setCategory(option);
                      setHistoryPages(1);
                      setFirstNewMaintenanceIndex(null);
                    }}
                  >
                    <Text color={selected ? 'on-primary' : 'muted'} variant="caption-strong">
                      {CATEGORY_LABELS[option]}
                    </Text>
                  </Button>
                );
              })}
            </div>

            <div className="w-full lg:ml-auto lg:w-52">
              <Text className="mb-1.5" color="muted" variant="caption">
                Ordenar por
              </Text>
              <Select
                value={sort}
                onValueChange={(value) => {
                  setSort(value as HistorySort);
                  setHistoryPages(1);
                  setFirstNewMaintenanceIndex(null);
                }}
              >
                <SelectTrigger aria-label="Ordenar historial">
                  <SelectValue>
                    {(value: HistorySort) => <Text variant="label">{SORT_LABELS[value]}</Text>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HISTORY_SORTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      <Text variant="label">{SORT_LABELS[option]}</Text>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {visibleMaintenances.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  <Text variant="label">Limpiar filtros</Text>
                </Button>
              }
              description="Probá con otra búsqueda o restablecé los filtros para ver todos los servicios."
              icon="SearchX"
              title="No encontramos coincidencias"
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
              {paginatedMaintenances.visible.map((maintenance, index) => (
                <MaintenanceCard
                  key={maintenance.id}
                  buttonRef={
                    index === firstNewMaintenanceIndex ? firstNewMaintenanceRef : undefined
                  }
                  maintenance={maintenance}
                  schedules={schedulesQuery.data}
                  onClick={() => openMaintenanceDetail(maintenance.id)}
                />
              ))}
            </div>
            {paginatedMaintenances.total > HISTORY_PAGE_SIZE ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <Text aria-live="polite" color="muted" variant="caption">
                  Mostrando {paginatedMaintenances.shown} de {paginatedMaintenances.total}
                </Text>
                {paginatedMaintenances.hasMore ? (
                  <Button
                    className="h-12 w-full gap-2 rounded-full lg:min-w-48 lg:w-auto"
                    variant="secondary"
                    onClick={() => {
                      setFirstNewMaintenanceIndex(paginatedMaintenances.shown);
                      setHistoryPages((pages) => pages + 1);
                    }}
                  >
                    <Text variant="label">Ver más</Text>
                    <Icon color="muted" name="ChevronDown" size="sm" />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </>
    );
  }

  return page(
    <>
      <section aria-label="Calendario mensual" className="mt-8">
        {calendar}
      </section>

      <section className="mt-8">
        <Text as="h2" className="px-1" color="muted" variant="overline">
          Historial completo
        </Text>
        <div className="mt-3">{history}</div>
      </section>

      {selectedDate && daySheetOpen ? (
        <DayMaintenanceSheet
          date={selectedDate}
          events={selectedEvents}
          open
          onOpenChange={(open) => {
            if (!open) setSelection(null);
          }}
          onSelectEvent={handleSelectEvent}
        />
      ) : null}
    </>,
  );
}

const CALENDAR_SKELETON_DAYS = Array.from({ length: 42 }, (_, index) => `day-${index + 1}`);
const CALENDAR_SKELETON_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const HISTORY_SKELETON_ITEMS = ['first', 'second', 'third'] as const;

function CalendarSkeleton() {
  return (
    <div
      aria-busy="true"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <Text className="sr-only">Cargando…</Text>
      <Skeleton className="h-12 w-full rounded-none" />

      <div className="grid grid-cols-7 border-y border-border bg-neutral-50 py-2.5">
        {CALENDAR_SKELETON_WEEKDAYS.map((weekday) => (
          <div className="flex justify-center" key={weekday}>
            <Skeleton className="h-3 w-4 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 p-2 lg:p-3">
        {CALENDAR_SKELETON_DAYS.map((day) => (
          <div
            className="flex min-h-12 items-center justify-center p-1.5 lg:min-h-24 lg:items-start lg:justify-start lg:p-2"
            key={day}
          >
            <Skeleton className="size-9 rounded-full" />
          </div>
        ))}
      </div>

      <div className="flex gap-4 border-t border-border px-4 py-3 lg:px-6">
        {HISTORY_SKELETON_ITEMS.map((item) => (
          <Skeleton className="h-4 w-20 rounded-full" key={item} />
        ))}
      </div>
    </div>
  );
}

function CalendarHistorySkeleton() {
  return (
    <div aria-busy="true">
      <Text className="sr-only">Cargando…</Text>
      <Skeleton className="h-12 w-full rounded-full" />
      <div className="mt-4 flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
        {HISTORY_SKELETON_ITEMS.map((item) => (
          <CalendarHistoryRowSkeleton key={item} />
        ))}
      </div>
    </div>
  );
}

function CalendarHistoryRowSkeleton() {
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
