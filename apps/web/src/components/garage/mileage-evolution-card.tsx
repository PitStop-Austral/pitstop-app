import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { InformationCard } from '@/components/garage/information-card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { MileageHistory, MileagePointSource } from '@/features/vehicles/api';
import { useMileageHistory } from '@/features/vehicles/queries';
import { formatLongDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { areaPath, linePath, monthTicks, xScale, yBounds, yScale } from './mileage-chart';

type MileageEvolutionCardProps = {
  vehicleId: string;
  onUpdateMileage: () => void;
};

const SOURCES: Record<MileagePointSource, { icon: IconName; text: string }> = {
  WINDOW_START: { icon: 'CalendarClock', text: 'Kilometraje al inicio del período' },
  INITIAL: { icon: 'CarFront', text: 'Alta del vehículo' },
  MAINTENANCE: { icon: 'Wrench', text: 'Mantenimiento' },
  UPDATE: { icon: 'Gauge', text: 'Actualización de km' },
};

function sourceText(source: MileagePointSource, label?: string): string {
  return source === 'MAINTENANCE' && label ? `Mantenimiento: ${label}` : SOURCES[source].text;
}

// The card is keyed by vehicle in the Garage, so the selection resets when the vehicle changes.
export function MileageEvolutionCard({ vehicleId, onUpdateMileage }: MileageEvolutionCardProps) {
  const query = useMileageHistory(vehicleId);

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <>
        <div className="flex gap-6">
          <div className="h-8 w-28 animate-pulse rounded-md bg-neutral-100" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-neutral-100" />
        </div>
        <div className="mt-6 h-44 animate-pulse rounded-lg bg-neutral-100 lg:h-48" />
      </>
    );
  } else if (query.isLoadingError) {
    body = (
      <StateMessage
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            <Text variant="label">Volver a intentar</Text>
          </Button>
        }
        description="Revisá tu conexión y volvé a intentarlo."
        icon="TriangleAlert"
        title="No pudimos cargar el kilometraje"
      />
    );
  } else if (query.data.readingsCount < 2 || query.data.points.length === 0) {
    // Future-dated readings count but are left out of points, so points can be empty.
    body = (
      <StateMessage
        action={
          <Button className="gap-2" variant="secondary" onClick={onUpdateMileage}>
            <Icon name="Gauge" size="sm" />
            <Text variant="label">Actualizar km</Text>
          </Button>
        }
        description="Actualizá el kilometraje cada tanto y acá vas a ver cómo avanza."
        icon="Gauge"
        title="Todavía no hay historial"
      />
    );
  } else {
    body = (
      <>
        {query.isRefetchError ? (
          <div className="mb-4 flex items-center gap-3">
            <Text color="danger" variant="caption">
              No pudimos actualizar el kilometraje.
            </Text>
            <Button variant="secondary" onClick={() => void query.refetch()}>
              <Text variant="label">Volver a intentar</Text>
            </Button>
          </div>
        ) : null}
        <MileageChart history={query.data} onUpdateMileage={onUpdateMileage} />
      </>
    );
  }

  return (
    <InformationCard icon="ChartLine" title="Evolución del kilometraje">
      {body}
    </InformationCard>
  );
}

function StateMessage({
  action,
  description,
  icon,
  title,
}: {
  action: ReactNode;
  description: string;
  icon: IconName;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-neutral-100">
        <Icon color="subtle" name={icon} size="lg" strokeWidth={1.75} />
      </div>
      <Text variant="subheading">{title}</Text>
      <Text className="mt-2 max-w-sm" color="muted" variant="body">
        {description}
      </Text>
      <div className="mt-6">{action}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text color="muted" variant="caption">
        {label}
      </Text>
      <div className="flex items-baseline gap-1">
        <Text className="tabular-nums" variant="heading">
          {value}
        </Text>
        <Text color="muted" variant="label">
          km
        </Text>
      </div>
    </div>
  );
}

function MileageChart({
  history,
  onUpdateMileage,
}: {
  history: MileageHistory;
  onUpdateMileage: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const pointRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { points } = history;
  const flat = points.length < 2;
  const bounds = yBounds(points);
  const x = xScale(history.from, history.to);
  const y = yScale(bounds);
  const coords = points.map((point) => ({ x: x(point.date), y: y(point.mileage) }));
  const yLabels = flat
    ? [{ value: points[0].mileage, y: coords[0].y }]
    : [bounds.max, (bounds.min + bounds.max) / 2, bounds.min].map((value) => ({
        value,
        y: y(value),
      }));
  // A refetch can shrink the list under a stale selection, which then counts as none.
  const focusIndex =
    selectedIndex !== null && selectedIndex < points.length ? selectedIndex : points.length - 1;
  const selected = selectedIndex === focusIndex ? points[focusIndex] : undefined;

  function select(index: number) {
    setSelectedIndex(index);
    pointRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = points.length - 1;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => select(Math.max(0, focusIndex - 1)),
      ArrowRight: () => select(Math.min(last, focusIndex + 1)),
      Home: () => select(0),
      End: () => select(last),
      Escape: () => setSelectedIndex(null),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  return (
    <>
      <div className="flex gap-6">
        <Stat label="Últimos 12 meses" value={`+${formatNumber(history.kmInPeriod)}`} />
        {flat ? null : (
          <Stat label="Promedio mensual" value={formatNumber(history.averageMonthlyKm)} />
        )}
      </div>

      {flat ? null : (
        <Text className="sr-only">
          Subió de {formatNumber(history.startMileage)} a {formatNumber(history.currentMileage)}{' '}
          kilómetros en los últimos 12 meses, {formatNumber(history.kmInPeriod)} kilómetros en
          total.
        </Text>
      )}

      <div className="mt-6 grid grid-cols-[48px_minmax(0,1fr)]">
        <div aria-hidden className="relative h-44 lg:h-48">
          {yLabels.map((label) => (
            <Text
              className="absolute right-2 -translate-y-1/2 tabular-nums"
              color="muted"
              key={label.value}
              style={{ top: `${label.y}%` }}
              variant="caption"
            >
              {formatNumber(label.value)}
            </Text>
          ))}
        </div>

        <div className="relative h-44 lg:h-48">
          {flat
            ? null
            : yLabels.map((label) => (
                <div
                  aria-hidden
                  className="absolute inset-x-0 border-t border-border"
                  key={label.value}
                  style={{ top: `${label.y}%` }}
                />
              ))}
          <svg
            aria-hidden
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <path className="fill-red-50" d={areaPath(coords)} />
            <path
              className="fill-none stroke-primary"
              d={linePath(coords)}
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {selected ? (
            <div
              aria-hidden
              className="absolute inset-y-0 border-l border-dashed border-neutral-400"
              style={{ left: `${coords[focusIndex].x}%` }}
            />
          ) : null}

          {flat ? (
            <div
              aria-hidden
              className="absolute -mt-[5px] -ml-[5px] size-2.5 rounded-full border-2 border-primary bg-card"
              style={{ left: `${coords[0].x}%`, top: `${coords[0].y}%` }}
            />
          ) : (
            <div
              aria-label="Evolución del kilometraje, últimos 12 meses. Usá las flechas para recorrer las lecturas."
              role="group"
              onKeyDown={handleKeyDown}
            >
              {points.map((point, index) => {
                const isSelected = index === selectedIndex;
                const source =
                  point.source === 'MAINTENANCE' && point.label
                    ? `mantenimiento ${point.label}`
                    : SOURCES[point.source].text.toLowerCase();
                return (
                  <button
                    aria-label={`${formatLongDate(point.date)}: ${formatNumber(point.mileage)} kilómetros, ${source}`}
                    aria-pressed={isSelected}
                    className="group absolute -mt-3 -ml-3 grid size-6 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    key={point.date}
                    ref={(element) => {
                      pointRefs.current[index] = element;
                    }}
                    style={{ left: `${coords[index].x}%`, top: `${coords[index].y}%` }}
                    tabIndex={index === focusIndex ? 0 : -1}
                    type="button"
                    onClick={() => setSelectedIndex(isSelected ? null : index)}
                  >
                    <div
                      className={cn(
                        'rounded-full border-2 border-primary',
                        isSelected
                          ? 'size-3.5 bg-primary ring-4 ring-primary/15'
                          : 'size-2.5 bg-card group-hover:size-3',
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div />
        <div aria-hidden className="relative mt-2 h-4">
          {monthTicks(history.from, history.to).map((tick) => (
            <Text
              className="absolute -translate-x-1/2"
              color="muted"
              key={tick.label}
              style={{ left: `${tick.x}%` }}
              variant="caption"
            >
              {tick.label}
            </Text>
          ))}
          <Text className="absolute right-0" variant="caption-strong">
            hoy
          </Text>
        </div>
      </div>

      <div aria-live="polite" className="mt-4 rounded-lg bg-neutral-100 p-3">
        {flat ? (
          <>
            <div className="flex items-center gap-1.5">
              <Icon color="muted" name="Info" size="xs" />
              <Text color="muted" variant="caption">
                No registraste aumentos de km en los últimos 12 meses.
              </Text>
            </div>
            <Button
              className="mt-1 h-auto px-0 hover:underline"
              variant="ghost"
              onClick={onUpdateMileage}
            >
              <Text color="primary" variant="caption-strong">
                Actualizar km
              </Text>
            </Button>
          </>
        ) : selected ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <Text variant="body-strong">{formatLongDate(selected.date)}</Text>
              <Text className="shrink-0 tabular-nums" variant="body-strong">
                {formatNumber(selected.mileage)} km
              </Text>
            </div>
            <div className="mt-1 flex items-start gap-1.5">
              <Icon
                className="mt-px shrink-0"
                color="muted"
                name={SOURCES[selected.source].icon}
                size="xs"
              />
              <Text color="muted" variant="caption">
                {sourceText(selected.source, selected.label)}
                {focusIndex > 0
                  ? ` · +${formatNumber(selected.mileage - points[focusIndex - 1].mileage)} km desde la lectura anterior`
                  : ''}
              </Text>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <Icon color="subtle" name="Info" size="xs" />
            <Text color="muted" variant="caption">
              Tocá un punto para ver la fecha y el kilometraje.
            </Text>
          </div>
        )}
      </div>
    </>
  );
}
