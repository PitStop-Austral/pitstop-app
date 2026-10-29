export const AUTH_MESSAGES = {
  email: 'Ingresá un email válido',
  generic: 'No pudimos completar la operación. Probá de nuevo',
  invalidCredential: 'El email o la contraseña no coinciden',
  currentPasswordIncorrect: 'La contraseña actual no es correcta',
  name: 'Ingresá tu nombre',
  networkRequestFailed: 'Revisá tu conexión y probá de nuevo',
  passwordRequired: 'Ingresá tu contraseña',
  passwordTooShort: 'Usá al menos 8 caracteres',
  passwordsDoNotMatch: 'Las contraseñas no coinciden',
  recentLoginRequired: 'Por seguridad, cerrá sesión y volvé a entrar para cambiar la contraseña',
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

export type ChangePasswordValues = {
  currentPassword: string;
  newPassword: string;
  passwordConfirmation: string;
};

export type RegistrationField = keyof RegistrationValues;
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;
export type LoginErrors = Partial<Record<keyof LoginValues, string>>;
export type ChangePasswordField = keyof ChangePasswordValues;
export type ChangePasswordErrors = Partial<Record<ChangePasswordField, string>>;
export type PasswordStrength = 'weak' | 'acceptable' | 'strong';

export type AuthOperationError =
  | { field: 'email' | 'password'; message: string; target: 'field' }
  | { message: string; target: 'form' };

export type ChangePasswordOperationError =
  | { field: ChangePasswordField; message: string; target: 'field' }
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

export function validateChangePassword(values: ChangePasswordValues): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};

  if (!values.currentPassword) {
    errors.currentPassword = AUTH_MESSAGES.passwordRequired;
  }

  if (values.newPassword.length < 8) {
    errors.newPassword = AUTH_MESSAGES.passwordTooShort;
  }

  if (values.passwordConfirmation !== values.newPassword) {
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

export function mapChangePasswordError(error: unknown): ChangePasswordOperationError {
  const code = getErrorCode(error);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return {
        field: 'currentPassword',
        message: AUTH_MESSAGES.currentPasswordIncorrect,
        target: 'field',
      };
    case 'auth/weak-password':
      return { field: 'newPassword', message: AUTH_MESSAGES.passwordTooShort, target: 'field' };
    case 'auth/too-many-requests':
      return { message: AUTH_MESSAGES.tooManyRequests, target: 'form' };
    case 'auth/requires-recent-login':
    case 'auth/user-mismatch':
    case 'auth/user-token-expired':
      return { message: AUTH_MESSAGES.recentLoginRequired, target: 'form' };
    case 'auth/network-request-failed':
      return { message: AUTH_MESSAGES.networkRequestFailed, target: 'form' };
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
