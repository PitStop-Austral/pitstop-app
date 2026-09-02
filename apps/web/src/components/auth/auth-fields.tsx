import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type AuthFieldProps = Omit<ComponentProps<typeof Input>, 'aria-label' | 'id'> & {
  error?: string;
  icon: ComponentProps<typeof Icon>['name'];
  id: string;
  label: string;
  trailingAction?: ReactNode;
};

export function AuthField({
  className,
  error,
  icon,
  id,
  label,
  trailingAction,
  ...inputProps
}: AuthFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label className="mb-2 hidden lg:block" htmlFor={id}>
        <Text as="span" color="emphasis" variant="label">
          {label}
        </Text>
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
          color="subtle"
          name={icon}
          size={18}
          strokeWidth={1.9}
        />
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          aria-label={label}
          className={cn(
            'h-[52px] pl-11',
            trailingAction && 'pr-12',
            error && 'border-destructive focus:border-destructive',
            className,
          )}
          id={id}
          {...inputProps}
        />
        {trailingAction}
      </div>
      {error ? (
        <Text className="mt-1.5" color="danger" id={errorId} variant="caption-strong">
          {error}
        </Text>
      ) : null}
    </div>
  );
}

type PasswordFieldProps = Omit<AuthFieldProps, 'icon' | 'trailingAction' | 'type'>;

export function PasswordField(props: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityLabel = isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña';

  return (
    <AuthField
      {...props}
      icon="Lock"
      type={isVisible ? 'text' : 'password'}
      trailingAction={
        <Button
          aria-label={visibilityLabel}
          className="absolute top-1/2 right-2 -translate-y-1/2 focus-visible:outline-3 focus-visible:outline-primary/50"
          size="icon"
          variant="ghost"
          onClick={() => setIsVisible((visible) => !visible)}
        >
          <Icon color="subtle" name={isVisible ? 'EyeOff' : 'Eye'} size="sm" />
        </Button>
      }
    />
  );
}
