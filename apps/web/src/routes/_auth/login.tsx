import { useMutation } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { AuthFormError } from '@/components/auth/auth-feedback';
import { AuthField, PasswordField } from '@/components/auth/auth-fields';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthSubmitButton } from '@/components/auth/auth-submit-button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import {
  mapAuthOperationError,
  validateLogin,
  type LoginErrors,
  type LoginValues,
} from '@/lib/auth-forms';
import { apiClient } from '@/lib/api-client';
import { auth } from '@/lib/firebase';
import { getSafeRedirect } from '@/lib/redirect';

type LoginSearch = { redirect?: string };

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: getSafeRedirect(search.redirect),
  }),
  component: LoginRoute,
});

const initialValues: LoginValues = { email: '', password: '' };

function LoginRoute() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string>();
  const [rememberMe, setRememberMe] = useState(true);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginValues) => {
      await signInWithEmailAndPassword(auth, credentials.email.trim(), credentials.password);
      await apiClient.get('/me', { skipUnauthorizedHandler: true });
    },
    onError: (error) => {
      const mappedError = mapAuthOperationError(error);
      if (mappedError.target === 'field') {
        setErrors((current) => ({ ...current, [mappedError.field]: mappedError.message }));
        return;
      }

      setFormError(mappedError.message);
    },
    onSuccess: () => navigate({ replace: true, to: redirect ?? '/' }),
  });

  function updateValue(field: keyof LoginValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginMutation.isPending) {
      return;
    }

    const nextErrors = validateLogin(values);
    setErrors(nextErrors);
    setFormError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    loginMutation.mutate(values);
  }

  return (
    <>
      <AuthHeader
        subtitle="Ingresá tus datos para volver a tu garage"
        title="Bienvenido de nuevo"
      />

      <form className="mt-10" noValidate onSubmit={handleSubmit}>
        {formError ? <AuthFormError message={formError} /> : null}

        <div className={formError ? 'mt-5 space-y-5' : 'space-y-5'}>
          <AuthField
            autoComplete="email"
            disabled={loginMutation.isPending}
            error={errors.email}
            icon="Mail"
            id="login-email"
            inputMode="email"
            label="Email"
            placeholder="Correo electrónico"
            type="email"
            value={values.email}
            onChange={(event) => updateValue('email', event.target.value)}
          />
          <PasswordField
            autoComplete="current-password"
            disabled={loginMutation.isPending}
            error={errors.password}
            id="login-password"
            label="Contraseña"
            placeholder="Contraseña"
            value={values.password}
            onChange={(event) => updateValue('password', event.target.value)}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Checkbox
              checked={rememberMe}
              id="remember-me"
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <label htmlFor="remember-me">
              <Text as="span" color="emphasis" variant="body">
                Recordarme
              </Text>
            </label>
          </div>
          <a
            className="rounded-sm focus-visible:outline-3 focus-visible:outline-primary/50"
            href="/forgot-password"
          >
            <Text as="span" color="primary" variant="body-strong">
              ¿Olvidaste tu contraseña?
            </Text>
          </a>
        </div>

        <div className="mt-8">
          <AuthSubmitButton
            busyLabel="Ingresando…"
            disabled={loginMutation.isPending}
            idleLabel="Ingresar"
          />
        </div>
      </form>

      <div className="mt-7 text-center">
        <Text as="div" color="muted" variant="body">
          ¿No tenés cuenta?{' '}
          <Link
            className="rounded-sm hover:underline focus-visible:outline-3 focus-visible:outline-primary/50"
            to="/register"
          >
            <Text as="span" color="primary" variant="body-strong">
              Registrate
            </Text>
          </Link>
        </Text>
      </div>
    </>
  );
}
