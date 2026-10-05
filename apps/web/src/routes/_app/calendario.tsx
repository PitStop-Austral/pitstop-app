import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { CalendarMileageCard } from '@/features/calendar/calendar-mileage-card';
import { toCalendarEvents } from '@/features/calendar/calendar-events';
import { MonthlyCalendar } from '@/features/calendar/monthly-calendar';
import {
  filterAndSortMaintenances,
  HISTORY_CATEGORIES,
  HISTORY_SORTS,
} from '@/features/maintenances/history-controls';
import type { HistoryCategory, HistorySort } from '@/features/maintenances/history-controls';
import { MaintenanceCard } from '@/features/maintenances/maintenance-card';
import { getArgentinaDateValue } from '@/features/maintenances/maintenance-form-schema';
import { useMaintenanceSheet } from '@/features/maintenances/maintenance-sheet-context';
import { useMaintenances } from '@/features/maintenances/queries';
import { useSchedules } from '@/features/schedules/queries';
import { sortSchedules } from '@/features/schedules/sort-schedules';
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

function SectionLoader({ label }: { label: string }) {
  return (
    <div className="grid min-h-48 place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Icon className="animate-spin" color="primary" name="Loader2" size="lg" />
        <Text color="muted" variant="body">
          {label}
        </Text>
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
  // Tied to the vehicle so switching vehicles drops the selection without an effect.
  const [selection, setSelection] = useState<{ vehicleId: string; date: string } | null>(null);
  const { activeVehicle, currentUserQuery, vehiclesQuery } = useActiveVehicle();
  const maintenancesQuery = useMaintenances(activeVehicle?.id);
  const schedulesQuery = useSchedules(activeVehicle?.id);
  const { openMaintenanceDetail, openRegisterMaintenance } = useMaintenanceSheet();

  function page(children: ReactNode) {
    return (
      <PageContainer>
        <CalendarHeader vehicle={activeVehicle} />
        {children}
      </PageContainer>
    );
  }

  if (vehiclesQuery.isPending || currentUserQuery.isPending) {
    return page(<SectionLoader label="Cargando calendario..." />);
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
  const selectedDate = selection?.vehicleId === activeVehicle.id ? selection.date : undefined;
  // Without a due date there is no real day to place it on: km-only rules get their own list.
  const mileageSchedules = sortSchedules(
    (schedulesQuery.data ?? []).filter((schedule) => schedule.nextDueDate == null),
  );

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
    calendar = <SectionLoader label="Cargando calendario..." />;
  } else {
    calendar = (
      <>
        {maintenancesQuery.isRefetchError || schedulesQuery.isRefetchError ? (
          <RefetchError message="No pudimos actualizar el calendario." onRetry={retryCalendar} />
        ) : null}
        <MonthlyCalendar
          eventsByDate={toCalendarEvents(maintenancesQuery.data, schedulesQuery.data)}
          selectedDate={selectedDate}
          today={today}
          onSelectDate={(date) => {
            // PIT-61 opens the day detail with this date and its events.
            setSelection({ vehicleId: activeVehicle.id, date });
          }}
        />
      </>
    );
  }

  const maintenances = maintenancesQuery.data ?? [];
  const visibleMaintenances = filterAndSortMaintenances(maintenances, { search, category, sort });
  const clearFilters = () => {
    setSearch('');
    setCategory('TODOS');
    setSort('date');
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
    history = <SectionLoader label="Cargando historial..." />;
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
              onChange={(event) => setSearch(event.target.value)}
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
                    onClick={() => setCategory(option)}
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
              <Select value={sort} onValueChange={(value) => setSort(value as HistorySort)}>
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
          <div className="mt-4 flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
            {visibleMaintenances.map((maintenance) => (
              <MaintenanceCard
                key={maintenance.id}
                maintenance={maintenance}
                onClick={() => openMaintenanceDetail(maintenance.id)}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return page(
    <>
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section
          aria-label="Calendario mensual"
          className={mileageSchedules.length > 0 ? 'xl:col-span-8' : 'xl:col-span-12'}
        >
          {calendar}
        </section>

        {mileageSchedules.length > 0 ? (
          <section className="xl:col-span-4">
            <Text as="h2" className="px-1" color="muted" variant="overline">
              Por kilometraje
            </Text>
            <div className="mt-3 flex flex-col gap-2.5">
              {mileageSchedules.map((schedule) => (
                <CalendarMileageCard key={schedule.id} schedule={schedule} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <section className="mt-8">
        <Text as="h2" className="px-1" color="muted" variant="overline">
          Historial completo
        </Text>
        <div className="mt-3">{history}</div>
      </section>
    </>,
  );
}
