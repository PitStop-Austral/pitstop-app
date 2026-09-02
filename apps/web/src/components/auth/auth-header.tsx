import { useNavigate } from '@tanstack/react-router';

import pitstopLogo from '@/assets/pitstop-logo.png';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type AuthHeaderProps = {
  backToLogin?: boolean;
  subtitle: string;
  title: string;
};

export function AuthHeader({ backToLogin = false, subtitle, title }: AuthHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="relative text-center">
      {backToLogin ? (
        <Button
          aria-label="Volver al inicio de sesión"
          className="absolute top-1 left-0 focus-visible:outline-3 focus-visible:outline-primary/50"
          size="icon"
          variant="ghost"
          onClick={() => navigate({ to: '/login' })}
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
