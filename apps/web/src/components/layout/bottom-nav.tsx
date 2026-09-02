import { Link } from '@tanstack/react-router';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NAV_ITEMS } from '@/lib/navigation';

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 lg:hidden"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-full border border-border/70 bg-white/80 p-1.5 shadow-lg backdrop-blur-xl">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavItem item={item} key={item.to} />
        ))}
        <button
          aria-label="Registrar mantenimiento"
          className="grid size-[52px] shrink-0 -translate-y-3 place-items-center rounded-full bg-primary shadow-lg transition hover:bg-red-700 active:scale-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          type="button"
        >
          <Icon color="on-primary" name="Plus" size="lg" strokeWidth={2.5} />
        </button>
        {NAV_ITEMS.slice(2).map((item) => (
          <NavItem item={item} key={item.to} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  return (
    <Link
      activeOptions={{ exact: item.to === '/' }}
      activeProps={{ className: 'text-primary' }}
      className="flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-subtle transition-colors hover:text-emphasis focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      to={item.to}
    >
      {({ isActive }) => (
        <>
          <Icon
            color={isActive ? 'primary' : 'subtle'}
            name={item.icon}
            size={22}
            strokeWidth={isActive ? 2.4 : 1.9}
          />
          <Text color={isActive ? 'primary' : 'subtle'} variant="caption-strong">
            {item.label}
          </Text>
        </>
      )}
    </Link>
  );
}
