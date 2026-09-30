import type { Maintenance } from './types';

export const HISTORY_CATEGORIES = ['TODOS', 'MANTENIMIENTO', 'ARREGLO'] as const;
export const HISTORY_SORTS = ['date', 'mileage', 'cost'] as const;

export type HistoryCategory = (typeof HISTORY_CATEGORIES)[number];
export type HistorySort = (typeof HISTORY_SORTS)[number];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');
}

function matchesCategory(maintenance: Maintenance, category: HistoryCategory): boolean {
  return category === 'TODOS' || maintenance.category === category;
}

function matchesSearch(maintenance: Maintenance, search: string): boolean {
  if (!search) return true;

  return [maintenance.type, maintenance.workshop, maintenance.notes]
    .filter((value): value is string => Boolean(value?.trim()))
    .some((value) => normalizeText(value).includes(search));
}

function compareBySort(left: Maintenance, right: Maintenance, sort: HistorySort): number {
  if (sort === 'date') return right.date.localeCompare(left.date);
  if (sort === 'mileage') return right.mileage - left.mileage;

  if (left.cost === null) return right.cost === null ? 0 : 1;
  if (right.cost === null) return -1;
  return right.cost - left.cost;
}

export function filterAndSortMaintenances(
  maintenances: Maintenance[],
  { search, category, sort }: { search: string; category: HistoryCategory; sort: HistorySort },
): Maintenance[] {
  const normalizedSearch = normalizeText(search.trim());

  return maintenances
    .filter(
      (maintenance) =>
        matchesCategory(maintenance, category) && matchesSearch(maintenance, normalizedSearch),
    )
    .toSorted((left, right) => compareBySort(left, right, sort));
}
