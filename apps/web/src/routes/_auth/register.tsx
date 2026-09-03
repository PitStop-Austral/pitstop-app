import { useMutation } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { AuthFormError, PasswordStrength } from '@/components/auth/auth-feedback';
import { AuthField, PasswordField } from '@/components/auth/auth-fields';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthSubmitButton } from '@/components/auth/auth-submit-button';
import { Text } from '@/components/ui/text';
import {
  AUTH_MESSAGES,
  mapAuthOperationError,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationField,
  type RegistrationValues,
} from '@/lib/auth-forms';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';

export const Route = createFileRoute('/_auth/register')({
  component: RegistrationRoute,
});

const initialValues: RegistrationValues = {
  email: '',
  name: '',
  password: '',
  passwordConfirmation: '',
};

const allFields: RegistrationField[] = ['name', 'email', 'password', 'passwordConfirmation'];

function RegistrationRoute() {
  const navigate = useNavigate();
  const { setIsAuthenticating } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState<Partial<Record<RegistrationField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState<string>();
  const [accountCreated, setAccountCreated] = useState(false);
  const validationErrors = validateRegistration(values);

  // Reset on unmount in case the user abandons a failed/retrying bootstrap
  // (e.g. clicks away to /login) instead of retrying — see docs/auth.md.
  useEffect(() => {
    return () => setIsAuthenticating(false);
  }, [setIsAuthenticating]);

  const registrationMutation = useMutation({
    mutationFn: async () => {
      // Stays true across failed retries (reset only in onSuccess below),
      // unlike login: createUserWithEmailAndPassword already makes `user`
      // truthy, and accountCreated deliberately keeps that Firebase session
      // alive across "Reintentar" so it doesn't recreate the account — the
      // guard must stay suppressed for that whole window, not just one call.
      setIsAuthenticating(true);
      let user = auth.currentUser;

      if (!accountCreated) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          values.email.trim(),
          values.password,
        );
        user = credential.user;
        setAccountCreated(true);
      }

      if (!user) {
        throw new Error(AUTH_MESSAGES.generic);
      }

      await updateProfile(user, { displayName: values.name.trim() });
      await user.getIdToken(true);
      await apiClient.get('/me', { skipUnauthorizedHandler: true });
    },
    onError: (error) => {
      const mappedError = mapAuthOperationError(error);
      if (mappedError.target === 'field') {
        setServerErrors((current) => ({
          ...current,
          [mappedError.field]: mappedError.message,
        }));
        setTouched((current) => ({ ...current, [mappedError.field]: true }));
        return;
      }

      setFormError(mappedError.message);
    },
    onSuccess: () => {
      setIsAuthenticating(false);
      navigate({ replace: true, to: '/' });
    },
  });

  function fieldError(field: RegistrationField): string | undefined {
    return serverErrors[field] ?? (touched[field] ? validationErrors[field] : undefined);
  }

  function updateValue(field: RegistrationField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(undefined);
  }

  function touchField(field: RegistrationField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registrationMutation.isPending) {
      return;
    }

    setFormError(undefined);

    if (!accountCreated) {
      setTouched(Object.fromEntries(allFields.map((field) => [field, true])));
      if (Object.keys(validationErrors).length > 0) {
        return;
      }
    }

    registrationMutation.mutate();
  }

  const fieldsDisabled = registrationMutation.isPending || accountCreated;

  return (
    <>
      <AuthHeader
        backToLogin
        subtitle="Empezá a llevar el mantenimiento de tus vehículos al día"
        title="Creá tu cuenta"
      />

      <form className="mt-10" noValidate onSubmit={handleSubmit}>
        {formError ? <AuthFormError message={formError} /> : null}

        <div className={formError ? 'mt-5 space-y-5' : 'space-y-5'}>
          <AuthField
            autoComplete="name"
            disabled={fieldsDisabled}
            error={fieldError('name')}
            icon="User"
            id="registration-name"
            label="Nombre y apellido"
            placeholder="Nombre y apellido"
            value={values.name}
            onBlur={() => touchField('name')}
            onChange={(event) => updateValue('name', event.target.value)}
          />
          <AuthField
            autoComplete="email"
            disabled={fieldsDisabled}
            error={fieldError('email')}
            icon="Mail"
            id="registration-email"
            inputMode="email"
            label="Email"
            placeholder="Correo electrónico"
            type="email"
            value={values.email}
            onBlur={() => touchField('email')}
            onChange={(event) => updateValue('email', event.target.value)}
          />
          <div>
            <PasswordField
              autoComplete="new-password"
              disabled={fieldsDisabled}
              error={fieldError('password')}
              id="registration-password"
              label="Contraseña"
              placeholder="Contraseña"
              value={values.password}
              onBlur={() => touchField('password')}
              onChange={(event) => updateValue('password', event.target.value)}
            />
            <PasswordStrength password={values.password} />
          </div>
          <PasswordField
            autoComplete="new-password"
            disabled={fieldsDisabled}
            error={fieldError('passwordConfirmation')}
            id="registration-password-confirmation"
            label="Repetir contraseña"
            placeholder="Repetir contraseña"
            value={values.passwordConfirmation}
            onBlur={() => touchField('passwordConfirmation')}
            onChange={(event) => updateValue('passwordConfirmation', event.target.value)}
          />
        </div>

        <div className="mt-9">
          <AuthSubmitButton
            busyLabel="Creando cuenta…"
            disabled={registrationMutation.isPending}
            idleLabel={accountCreated ? 'Reintentar' : 'Crear cuenta'}
          />
        </div>
      </form>

      <div className="mt-7 text-center">
        <Text as="div" color="muted" variant="body">
          ¿Ya tenés cuenta?{' '}
          <Link
            className="rounded-sm hover:underline focus-visible:outline-3 focus-visible:outline-primary/50"
            to="/login"
          >
            <Text as="span" color="primary" variant="body-strong">
              Iniciá sesión
            </Text>
          </Link>
        </Text>
      </div>
    </>
  );
}
