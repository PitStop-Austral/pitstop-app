import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { AuthFormError } from '@/components/auth/auth-feedback';
import { AuthField } from '@/components/auth/auth-fields';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthSubmitButton } from '@/components/auth/auth-submit-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AUTH_MESSAGES, validateEmail } from '@/lib/auth-forms';
import { auth } from '@/lib/firebase';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);

  const resetPasswordMutation = useMutation({
    mutationFn: () => sendPasswordResetEmail(auth, email.trim()),
    onError: (error) => {
      const code = getErrorCode(error);

      if (code === 'auth/invalid-email') {
        setEmailError(AUTH_MESSAGES.email);
        return;
      }

      if (code === 'auth/too-many-requests') {
        setFormError(AUTH_MESSAGES.tooManyRequests);
        return;
      }

      setSent(true);
    },
    onSuccess: () => setSent(true),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetPasswordMutation.isPending) {
      return;
    }

    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(undefined);

    if (nextEmailError) {
      return;
    }

    resetPasswordMutation.mutate();
  }

  function useAnotherEmail() {
    setEmail('');
    setEmailError(undefined);
    setFormError(undefined);
    setSent(false);
  }

  if (sent) {
    return (
      <section className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50">
          <Icon color="primary" name="MailCheck" size={28} strokeWidth={1.75} />
        </div>
        <Text className="mt-7" variant="title">
          Revisá tu correo
        </Text>
        <Text className="mx-auto mt-3 max-w-[19rem]" color="muted" variant="body">
          Si{' '}
          <Text as="span" color="default" variant="body-strong">
            {email.trim()}
          </Text>{' '}
          tiene una cuenta en PitStop, te enviamos un enlace para restablecer tu contraseña.
        </Text>
        <Button
          className="mt-9 h-[52px] w-full focus-visible:outline-3 focus-visible:outline-primary/50"
          onClick={() => navigate({ to: '/login' })}
        >
          <Text color="on-primary" variant="label">
            Volver a iniciar sesión
          </Text>
        </Button>
        <Button
          className="mt-3 focus-visible:outline-3 focus-visible:outline-primary/50 hover:underline"
          variant="ghost"
          onClick={useAnotherEmail}
        >
          <Text color="muted" variant="label">
            Usar otro email
          </Text>
        </Button>
      </section>
    );
  }

  return (
    <>
      <AuthHeader
        backToLogin
        subtitle="Ingresá tu email y te mandamos un enlace para crear una nueva"
        title="¿Olvidaste tu contraseña?"
      />

      <form className="mt-10" noValidate onSubmit={handleSubmit}>
        {formError ? <AuthFormError message={formError} /> : null}

        <div className={formError ? 'mt-5' : undefined}>
          <AuthField
            autoComplete="email"
            disabled={resetPasswordMutation.isPending}
            error={emailError}
            icon="Mail"
            id="forgot-password-email"
            inputMode="email"
            label="Email"
            placeholder="Correo electrónico"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError(undefined);
              setFormError(undefined);
            }}
          />
        </div>

        <div className="mt-8">
          <AuthSubmitButton
            busyLabel="Enviando…"
            disabled={resetPasswordMutation.isPending}
            idleLabel="Enviar enlace"
          />
        </div>
      </form>
    </>
  );
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}
