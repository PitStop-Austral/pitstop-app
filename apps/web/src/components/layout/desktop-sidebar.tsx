import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import pitstopLogo from '@/assets/pitstop-logo.png';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NAV_ITEMS } from '@/lib/navigation';

export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:flex ${collapsed ? 'w-20' : 'w-64'}`}
    >
      <button
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        className="absolute -right-4 top-8 z-10 grid size-8 place-items-center rounded-full border border-border bg-card shadow-sm transition hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => setCollapsed((value) => !value)}
        type="button"
      >
        <Icon color="muted" name={collapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size="sm" />
      </button>

      <div className="flex h-24 items-center justify-center">
        <img
          alt="PitStop"
          className={`w-auto object-contain transition-[height] duration-300 ${collapsed ? 'h-7' : 'h-14'}`}
          src={pitstopLogo}
        />
      </div>

      <nav aria-label="Navegación principal" className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <Link
            activeOptions={{ exact: item.to === '/' }}
            activeProps={{ className: 'bg-red-50 text-primary' }}
            aria-label={collapsed ? item.label : undefined}
            className={`flex min-h-11 items-center rounded-[14px] text-muted transition-colors hover:bg-neutral-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${collapsed ? 'justify-center px-0' : 'gap-3 px-3.5'}`}
            key={item.to}
            title={collapsed ? item.label : undefined}
            to={item.to}
          >
            {({ isActive }) => (
              <>
                <Icon
                  color={isActive ? 'primary' : 'muted'}
                  name={item.icon}
                  size="md"
                  strokeWidth={isActive ? 2.3 : 1.9}
                />
                {!collapsed && (
                  <Text color={isActive ? 'primary' : 'muted'} variant="label">
                    {item.label}
                  </Text>
                )}
              </>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto p-4">
        <button
          aria-label="Registrar mantenimiento"
          className={`flex min-h-12 items-center justify-center rounded-full bg-primary shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${collapsed ? 'size-12' : 'w-full gap-2 px-4'}`}
          type="button"
        >
          <Icon color="on-primary" name="Plus" size="md" />
          {!collapsed && (
            <Text color="on-primary" variant="label">
              Registrar mantenimiento
            </Text>
          )}
        </button>
      </div>
    </aside>
  );
}
