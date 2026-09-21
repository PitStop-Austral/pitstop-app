import bateryIcon from '../../assets/service-icons/batery.webp';
import cleanIcon from '../../assets/service-icons/clean.webp';
import engineIcon from '../../assets/service-icons/engine.webp';
import filterIcon from '../../assets/service-icons/filter.webp';
import generalIcon from '../../assets/service-icons/general.webp';
import oilFilterIcon from '../../assets/service-icons/oil-filter.webp';
import refrigeranteIcon from '../../assets/service-icons/refrigerante.webp';
import sparkPlugIcon from '../../assets/service-icons/spark-plug.webp';
import suspensionIcon from '../../assets/service-icons/suspension.webp';
import turboIcon from '../../assets/service-icons/turbo.webp';
import gearIcon from '../../assets/vehicle-icons/gear.webp';
import lightIcon from '../../assets/vehicle-icons/light.webp';
import oilIcon from '../../assets/vehicle-icons/oil.webp';
import wheelsIcon from '../../assets/vehicle-icons/wheels.webp';

export const OTHER_SERVICE = 'Otro';
export const DEFAULT_SERVICE = 'Cambio de aceite';

export const SERVICE_OPTIONS = [
  { name: DEFAULT_SERVICE, icon: oilIcon },
  { name: 'Filtros', icon: filterIcon },
  { name: 'Filtro de aire', icon: filterIcon },
  { name: 'Filtro de aceite', icon: oilFilterIcon },
  { name: 'Filtro de combustible', icon: filterIcon },
  { name: 'Frenos', icon: wheelsIcon },
  { name: 'Líquido de frenos', icon: generalIcon },
  { name: 'Neumáticos', icon: wheelsIcon },
  { name: 'Rotación de neumáticos', icon: wheelsIcon },
  { name: 'Alineación de neumáticos', icon: wheelsIcon },
  { name: 'Alineación y balanceo', icon: wheelsIcon },
  { name: 'Batería', icon: bateryIcon },
  { name: 'Correa de distribución', icon: engineIcon },
  { name: 'Motor', icon: engineIcon },
  { name: 'Caja y transmisión', icon: gearIcon },
  { name: 'Refrigerante', icon: refrigeranteIcon },
  { name: 'Bujías', icon: sparkPlugIcon },
  { name: 'Suspensión', icon: suspensionIcon },
  { name: 'Turbo', icon: turboIcon },
  { name: 'Luces', icon: lightIcon },
  { name: 'Limpieza', icon: cleanIcon },
  { name: OTHER_SERVICE, icon: generalIcon },
] as const;

export type ServiceOptionName = (typeof SERVICE_OPTIONS)[number]['name'];

export type ServiceFieldValue = {
  option: ServiceOptionName;
  customName: string;
};

function normalizeServiceType(type: string): string {
  return type.toLocaleLowerCase('es-AR');
}

function findServiceOption(type: string) {
  const normalizedType = normalizeServiceType(type);
  return SERVICE_OPTIONS.find(({ name }) => normalizeServiceType(name) === normalizedType);
}

export function isKnownService(type: string): boolean {
  const option = findServiceOption(type);
  return option !== undefined && option.name !== OTHER_SERVICE;
}

export function serviceIconFor(type: string): string {
  return findServiceOption(type)?.icon ?? generalIcon;
}

export function toServiceFieldValue(type?: string): ServiceFieldValue {
  if (!type) {
    return { option: DEFAULT_SERVICE, customName: '' };
  }

  const option = findServiceOption(type);
  if (option && option.name !== OTHER_SERVICE) {
    return { option: option.name, customName: '' };
  }

  return { option: OTHER_SERVICE, customName: type };
}

export function resolveServiceType(value: ServiceFieldValue): string {
  return value.option === OTHER_SERVICE ? value.customName.trim() : value.option;
}
