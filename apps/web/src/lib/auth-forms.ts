export const AUTH_MESSAGES = {
  email: 'Ingresá un email válido',
  generic: 'No pudimos completar la operación. Probá de nuevo',
  invalidCredential: 'El email o la contraseña no coinciden',
  name: 'Ingresá tu nombre',
  passwordRequired: 'Ingresá tu contraseña',
  passwordTooShort: 'Usá al menos 8 caracteres',
  passwordsDoNotMatch: 'Las contraseñas no coinciden',
  tooManyRequests: 'Demasiados intentos. Probá de nuevo en unos minutos',
  usedEmail: 'Ya existe una cuenta con este email',
} as const;

export type LoginValues = {
  email: string;
  password: string;
};

export type RegistrationValues = LoginValues & {
  name: string;
  passwordConfirmation: string;
};

export type RegistrationField = keyof RegistrationValues;
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;
export type LoginErrors = Partial<Record<keyof LoginValues, string>>;
export type PasswordStrength = 'weak' | 'acceptable' | 'strong';

export type AuthOperationError =
  | { field: 'email' | 'password'; message: string; target: 'field' }
  | { message: string; target: 'form' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  return EMAIL_PATTERN.test(email.trim()) ? undefined : AUTH_MESSAGES.email;
}

export function validateLogin(values: LoginValues): LoginErrors {
  const errors: LoginErrors = {};
  const emailError = validateEmail(values.email);

  if (emailError) {
    errors.email = emailError;
  }

  if (!values.password) {
    errors.password = AUTH_MESSAGES.passwordRequired;
  }

  return errors;
}

export function validateRegistration(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = {};

  if (values.name.replaceAll(/\s/g, '').length < 2) {
    errors.name = AUTH_MESSAGES.name;
  }

  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (values.password.length < 8) {
    errors.password = AUTH_MESSAGES.passwordTooShort;
  }

  if (values.passwordConfirmation !== values.password) {
    errors.passwordConfirmation = AUTH_MESSAGES.passwordsDoNotMatch;
  }

  return errors;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) {
    return 'weak';
  }

  const hasLettersAndNumbers = /\p{L}/u.test(password) && /\p{N}/u.test(password);
  return password.length >= 12 && hasLettersAndNumbers ? 'strong' : 'acceptable';
}

export function mapAuthOperationError(error: unknown): AuthOperationError {
  const code = getErrorCode(error);

  switch (code) {
    case 'auth/email-already-in-use':
      return { field: 'email', message: AUTH_MESSAGES.usedEmail, target: 'field' };
    case 'auth/weak-password':
      return { field: 'password', message: AUTH_MESSAGES.passwordTooShort, target: 'field' };
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return { message: AUTH_MESSAGES.invalidCredential, target: 'form' };
    case 'auth/too-many-requests':
      return { message: AUTH_MESSAGES.tooManyRequests, target: 'form' };
    default:
      return { message: AUTH_MESSAGES.generic, target: 'form' };
  }
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}
