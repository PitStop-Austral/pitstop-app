import { Link, createFileRoute } from '@tanstack/react-router';

import authBanner from '@/assets/auth-banner.webp';
import pitstopLogo from '@/assets/pitstop-logo.png';
import { GuestOnly } from '@/components/auth/guest-only';
import { buttonVariants } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getPostAuthRedirect } from '@/lib/redirect';
import { cn } from '@/lib/utils';

type WelcomeSearch = { redirect?: string };

export const Route = createFileRoute('/bienvenida')({
  validateSearch: (search: Record<string, unknown>): WelcomeSearch => ({
    redirect: getPostAuthRedirect(search.redirect),
  }),
  component: WelcomeRoute,
});

const BENEFITS: { icon: IconName; title: string; description: string }[] = [
  {
    icon: 'CarFront',
    title: 'Todos tus vehículos',
    description: 'Datos y kilometraje de cada auto, siempre a mano.',
  },
  {
    icon: 'Wrench',
    title: 'Historial de servicios',
    description: 'Registrá lo que hiciste y encontralo cuando lo necesites.',
  },
  {
    icon: 'CalendarDays',
    title: 'Próximos mantenimientos',
    description: 'Sabé qué servicio se acerca antes de que se te pase.',
  },
];

const focusOnPhoto =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
const focusOnLight =
  'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const footerLink = cn(focusOnLight, 'hover:underline');
const rise = 'motion-safe:animate-landing-rise';
const arrowNudge = 'motion-safe:transition-transform motion-safe:group-hover:translate-x-1';

function WelcomeRoute() {
  const { redirect } = Route.useSearch();

  return (
    <GuestOnly redirect={redirect}>
      <div className="bg-background">
        <section
          className="relative flex min-h-app flex-col overflow-hidden bg-neutral-900"
          id="top"
        >
          <img
            alt=""
            className="absolute inset-0 size-full object-cover"
            decoding="async"
            fetchPriority="high"
            src={authBanner}
          />
          <div className="absolute inset-0 bg-linear-to-t from-neutral-900 to-neutral-900/25 lg:bg-linear-to-r lg:from-neutral-900/95 lg:to-neutral-900/15" />

          <div className="safe-top relative mx-auto flex w-full max-w-7xl lg:max-w-[1440px] flex-1 flex-col justify-end px-6 pb-14 lg:justify-center lg:px-16 lg:pb-36">
            <div className="max-w-2xl">
              <Text
                as="p"
                className={cn(rise, '[animation-delay:80ms]')}
                color="inverse"
                variant="overline"
              >
                Tu copiloto para el cuidado del auto
              </Text>
              <Text
                className={cn(rise, 'mt-4 [animation-delay:180ms]')}
                color="inverse"
                variant="landing-headline"
              >
                Tu garage,
                <Text as="span" className="block" color="primary" variant="landing-headline">
                  siempre al día.
                </Text>
              </Text>
              <div className={cn(rise, 'mt-5 max-w-md [animation-delay:310ms]')}>
                <div className="opacity-80">
                  <Text color="inverse" variant="body">
                    Guardá el historial de tus vehículos y enterate qué mantenimiento viene después.
                  </Text>
                </div>
              </div>
              <div className={cn(rise, 'mt-8 flex gap-2 [animation-delay:440ms] lg:gap-3')}>
                <Link
                  className={cn(
                    buttonVariants({}),
                    focusOnPhoto,
                    'group min-h-12 shrink-0 gap-3 shadow-lg max-[374px]:gap-1.5 max-[374px]:px-4 lg:px-8',
                  )}
                  search={{ redirect }}
                  to="/register"
                >
                  <Text color="on-primary" variant="label">
                    Empezar gratis
                  </Text>
                  <Icon
                    className={cn(arrowNudge, 'max-[374px]:size-4')}
                    color="on-primary"
                    name="ArrowRight"
                    size="md"
                  />
                </Link>
                <Link
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    focusOnPhoto,
                    'min-h-12 shrink-0 hover:bg-white/10 max-[374px]:px-2',
                  )}
                  search={{ redirect }}
                  to="/login"
                >
                  <Text color="inverse" variant="label">
                    Iniciar sesión
                  </Text>
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 hidden border-t border-white/15 lg:block">
            <div className="mx-auto max-w-7xl lg:max-w-[1440px] px-16 py-5">
              <div className="opacity-60">
                <Text color="inverse" variant="overline">
                  Todo lo que tu auto necesita, en un solo lugar
                </Text>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl lg:max-w-[1440px] px-6 py-16 lg:px-20 lg:py-24">
          <Text as="p" color="primary" variant="overline">
            Menos olvidos. Más camino.
          </Text>
          <Text className="mt-4 max-w-xl lg:max-w-none" variant="landing-section-title">
            Todo el cuidado de tu auto, bajo control.
          </Text>

          <ul className="mt-12 grid gap-10 border-t border-border pt-10 md:grid-cols-3 md:gap-12">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title}>
                <Icon color="primary" name={benefit.icon} size="xl" />
                <Text as="h3" className="mt-5" variant="heading">
                  {benefit.title}
                </Text>
                <Text className="mt-3 max-w-xs" color="muted" variant="body">
                  {benefit.description}
                </Text>
              </li>
            ))}
          </ul>

          <Link
            className={cn(focusOnLight, 'group mt-12 inline-flex items-center gap-2')}
            search={{ redirect }}
            to="/register"
          >
            <Text color="primary" variant="label">
              Crear mi cuenta
            </Text>
            <Icon className={arrowNudge} color="primary" name="ArrowRight" size="sm" />
          </Link>
        </section>

        <footer className="safe-bottom border-t border-border bg-card">
          <div className="mx-auto max-w-7xl lg:max-w-[1440px] px-6 pt-12 lg:px-20">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <img alt="PitStop" className="h-14 w-auto" src={pitstopLogo} />
                <Text className="mt-4 max-w-xs" color="muted" variant="body">
                  Cada servicio cuenta. Tené todo el cuidado de tu auto en un solo lugar.
                </Text>
              </div>
              <nav aria-label="Accesos" className="flex flex-wrap gap-x-6 gap-y-3 md:gap-x-7">
                <a className={footerLink} href="#top">
                  <Text color="emphasis" variant="label">
                    Volver arriba
                  </Text>
                </a>
                <Link className={footerLink} search={{ redirect }} to="/login">
                  <Text color="emphasis" variant="label">
                    Iniciar sesión
                  </Text>
                </Link>
                <Link className={footerLink} search={{ redirect }} to="/register">
                  <Text color="primary" variant="label">
                    Crear cuenta
                  </Text>
                </Link>
              </nav>
            </div>
            <div className="mt-10 border-t border-border py-6">
              <Text color="muted" variant="caption">
                © {new Date().getFullYear()} PitStop
              </Text>
            </div>
          </div>
        </footer>
      </div>
    </GuestOnly>
  );
}
