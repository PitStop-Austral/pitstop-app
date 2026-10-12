import { useNavigate } from '@tanstack/react-router';

import pitstopLogo from '@/assets/pitstop-logo.png';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type AuthHeaderProps = {
  back?: { to: '/login' | '/bienvenida'; redirect?: string };
  subtitle: string;
  title: string;
};

export function AuthHeader({ back, subtitle, title }: AuthHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="relative text-center">
      {back ? (
        <Button
          aria-label={
            back.to === '/login' ? 'Volver al inicio de sesión' : 'Volver a la bienvenida'
          }
          className="absolute top-1 left-0 focus-visible:outline-3 focus-visible:outline-primary/50"
          size="icon"
          variant="ghost"
          onClick={() => navigate({ to: back.to, search: { redirect: back.redirect } })}
        >
          <Icon color="muted" name="ArrowLeft" size="md" />
        </Button>
      ) : null}

      <img alt="PitStop" className="mx-auto h-11 w-auto" src={pitstopLogo} />
      <Text className="mt-8" variant="title">
        {title}
      </Text>
      <Text className="mx-auto mt-3 max-w-[19rem]" color="muted" variant="body">
        {subtitle}
      </Text>
    </header>
  );
}
