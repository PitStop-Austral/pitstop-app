export function AppHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
        <div aria-label="PitStop" className="h-12 w-32 rounded-md bg-neutral-100" role="img" />
      </div>
    </header>
  );
}
