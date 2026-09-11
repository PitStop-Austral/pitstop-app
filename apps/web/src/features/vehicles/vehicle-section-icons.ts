import carIcon from '@/assets/vehicle-icons/car.webp';
import gearIcon from '@/assets/vehicle-icons/gear.webp';
import lightIcon from '@/assets/vehicle-icons/light.webp';
import oilIcon from '@/assets/vehicle-icons/oil.webp';
import wheelsIcon from '@/assets/vehicle-icons/wheels.webp';

export const VEHICLE_SECTION_ICONS = {
  identification: carIcon,
  lubricants: oilIcon,
  transmission: gearIcon,
  tires: wheelsIcon,
  lights: lightIcon,
} as const;
