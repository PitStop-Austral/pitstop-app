import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getPasswordStrength } from '@/lib/auth-forms';

type AuthFormErrorProps = {
  message: string;
};

export function AuthFormError({ message }: AuthFormErrorProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3" role="alert">
      <Icon className="mt-0.5 shrink-0" color="danger" name="CircleAlert" size="sm" />
      <Text color="danger" variant="body">
        {message}
      </Text>
    </div>
  );
}

type PasswordStrengthProps = {
  password: string;
};

const strengthConfig = {
  acceptable: { color: 'warning', label: 'Aceptable', width: 'w-2/3' },
  strong: { color: 'success', label: 'Fuerte', width: 'w-full' },
  weak: { color: 'danger', label: 'Débil', width: 'w-1/3' },
} as const;

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = getPasswordStrength(password);
  const config = strengthConfig[strength];

  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full transition-[width] ${config.width} ${
            config.color === 'danger'
              ? 'bg-destructive'
              : config.color === 'warning'
                ? 'bg-warning'
                : 'bg-success'
          }`}
        />
      </div>
      <Text color={config.color} variant="caption-strong">
        {config.label}
      </Text>
    </div>
  );
}
