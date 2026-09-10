import pitstopLogo from '@/assets/pitstop-logo.png';
import { VehiclePicker } from '@/features/vehicles/vehicle-picker';

export function AppHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-4 px-4">
        <img alt="PitStop" className="h-12 w-auto object-contain" src={pitstopLogo} />
        <VehiclePicker className="max-w-[58%]" />
      </div>
    </header>
  );
}
