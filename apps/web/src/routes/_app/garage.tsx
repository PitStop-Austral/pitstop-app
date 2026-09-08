import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Odometer } from '@/components/odometer';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/features/users/queries';
import { FUEL_LABELS } from '@/features/vehicles/types';
import type { Vehicle } from '@/features/vehicles/types';
import { useVehicles } from '@/features/vehicles/queries';
import { VehicleFormSheet } from '@/features/vehicles/vehicle-form-sheet';
import { formatNumber } from '@/lib/format';

const GARAGE_TABS = ['info', 'recomendados', 'historial', 'deseos'] as const;
type GarageTab = (typeof GARAGE_TABS)[number];
type GarageSearch = { tab: GarageTab };

export const Route = createFileRoute('/_app/garage')({
  validateSearch: (search: Record<string, unknown>): GarageSearch => ({
    tab: GARAGE_TABS.includes(search.tab as GarageTab) ? (search.tab as GarageTab) : 'info',
  }),
  component: GaragePage,
});

function GaragePage() {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const vehiclesQuery = useVehicles();
  const currentUserQuery = useCurrentUser();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  if (vehiclesQuery.isPending || currentUserQuery.isPending) {
    return (
      <PageContainer>
        <Text variant="title">Garage</Text>
        <div className="grid min-h-72 place-items-center">
          <div className="flex flex-col items-center gap-3">
            <Icon className="animate-spin" color="primary" name="Loader2" size="lg" />
            <Text color="muted" variant="body">
              Cargando tu garage...
            </Text>
          </div>
        </div>
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
                  void Promise.all([vehiclesQuery.refetch(), currentUserQuery.refetch()]);
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

  const vehicles = vehiclesQuery.data;
  const activeVehicle =
    vehicles.find((vehicle) => vehicle.id === currentUserQuery.data.activeVehicleId) ?? vehicles[0];

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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <VehicleHeroCard vehicle={activeVehicle} />

        <Tabs
          value={tab}
          onValueChange={(next) =>
            navigate({ to: '/garage', search: { tab: next as GarageTab }, replace: true })
          }
        >
          <TabsList className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 bg-background/92 backdrop-blur-xl lg:top-0">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="recomendados">Recomendados</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="deseos">Deseos</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <IdentificationPanel vehicle={activeVehicle} />
          </TabsContent>
          <TabsContent value="recomendados">
            <EmptyState
              description="Pronto vamos a sugerirte mantenimientos según el kilometraje y la antigüedad de tu vehículo."
              icon="Sparkles"
              title="Todavía no tenemos recomendaciones"
            />
          </TabsContent>
          <TabsContent value="historial">
            <EmptyState
              description="Acá vas a ver los mantenimientos que le registraste a tu vehículo."
              icon="History"
              title="Todavía no armamos esto"
            />
          </TabsContent>
          <TabsContent value="deseos">
            <EmptyState
              description="Acá vas a poder guardar los mantenimientos o mejoras que tengas pensados para tu vehículo."
              icon="Heart"
              title="Todavía no armamos esto"
            />
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
    </PageContainer>
  );
}

function PageContainer({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-10 lg:py-10">{children}</section>
  );
}

function VehicleHeroCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-4 lg:sticky lg:top-10">
      <div className="grid aspect-video place-items-center rounded-[16px] bg-neutral-100 lg:aspect-[4/3]">
        <Icon color="subtle" name="CarFront" size={64} strokeWidth={1.5} />
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <Text variant="subheading">
            {vehicle.brand} {vehicle.model}
          </Text>
          <StatusChip status="current" />
        </div>
        <Text className="mt-1" color="muted" variant="body">
          {vehicle.year} · {FUEL_LABELS[vehicle.fuel]}
          {vehicle.nickname ? ` · "${vehicle.nickname}"` : ''}
        </Text>
        <div className="mt-4">
          <Odometer value={vehicle.mileage} />
        </div>
      </div>
    </div>
  );
}

function IdentificationPanel({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[12px] bg-neutral-100 shadow-sm">
          <Icon color="emphasis" name="CarFront" size="md" />
        </div>
        <Text variant="subheading">Identificación</Text>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5">
        <InfoField label="Marca" value={vehicle.brand} />
        <InfoField label="Modelo" value={vehicle.model} />
        <InfoField label="Año" value={String(vehicle.year)} />
        <InfoField label="Combustible" value={FUEL_LABELS[vehicle.fuel]} />
        <InfoField label="Patente" value={vehicle.plate} />
        <InfoField label="Kilometraje" value={`${formatNumber(vehicle.mileage)} km`} />
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text className="block" color="muted" variant="label">
        {label}
      </Text>
      <Text className="mt-1 block" variant="body-strong">
        {value}
      </Text>
    </div>
  );
}
