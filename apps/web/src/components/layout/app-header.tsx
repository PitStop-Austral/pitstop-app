import pitstopLogo from '@/assets/pitstop-logo.png';

export function AppHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
        <img alt="PitStop" className="h-12 w-auto object-contain" src={pitstopLogo} />
      </div>
    </header>
  );
}
