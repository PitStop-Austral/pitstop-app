import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_MESSAGES,
  getPasswordStrength,
  mapChangePasswordError,
  mapAuthOperationError,
  validateChangePassword,
  validateEmail,
  validateLogin,
  validateRegistration,
} from './auth-forms.ts';

test('registration validates every required rule', () => {
  assert.deepStrictEqual(
    validateRegistration({
      email: 'not-an-email',
      name: ' A ',
      password: 'short',
      passwordConfirmation: 'different',
    }),
    {
      email: AUTH_MESSAGES.email,
      name: AUTH_MESSAGES.name,
      password: AUTH_MESSAGES.passwordTooShort,
      passwordConfirmation: AUTH_MESSAGES.passwordsDoNotMatch,
    },
  );
});

test('registration accepts trimmed names, valid email, and matching passwords', () => {
  assert.deepStrictEqual(
    validateRegistration({
      email: 'persona@example.com',
      name: ' Ada Lovelace ',
      password: 'formula42',
      passwordConfirmation: 'formula42',
    }),
    {},
  );
});

test('login only requires a valid email and a non-empty password', () => {
  assert.deepStrictEqual(validateLogin({ email: 'bad', password: '' }), {
    email: AUTH_MESSAGES.email,
    password: AUTH_MESSAGES.passwordRequired,
  });
  assert.deepStrictEqual(validateLogin({ email: 'person@example.com', password: 'old' }), {});
});

test('change password validates every required rule', () => {
  assert.deepStrictEqual(
    validateChangePassword({
      currentPassword: '',
      newPassword: 'short',
      passwordConfirmation: 'different',
    }),
    {
      currentPassword: AUTH_MESSAGES.passwordRequired,
      newPassword: AUTH_MESSAGES.passwordTooShort,
      passwordConfirmation: AUTH_MESSAGES.passwordsDoNotMatch,
    },
  );
  assert.deepStrictEqual(
    validateChangePassword({
      currentPassword: 'current-password',
      newPassword: 'new-password',
      passwordConfirmation: 'new-password',
    }),
    {},
  );
});

test('email validation trims surrounding whitespace', () => {
  assert.equal(validateEmail(' person@example.com '), undefined);
  assert.equal(validateEmail('not-an-email'), AUTH_MESSAGES.email);
});

test('password strength follows the ticket boundaries', () => {
  assert.equal(getPasswordStrength('1234567'), 'weak');
  assert.equal(getPasswordStrength('12345678'), 'acceptable');
  assert.equal(getPasswordStrength('abcdefghijkl'), 'acceptable');
  assert.equal(getPasswordStrength('abcdefghijk1'), 'strong');
});

test('Firebase errors map to safe Spanish messages', () => {
  assert.deepStrictEqual(mapAuthOperationError({ code: 'auth/email-already-in-use' }), {
    field: 'email',
    message: AUTH_MESSAGES.usedEmail,
    target: 'field',
  });
  assert.deepStrictEqual(mapAuthOperationError({ code: 'auth/invalid-credential' }), {
    message: AUTH_MESSAGES.invalidCredential,
    target: 'form',
  });
  assert.deepStrictEqual(mapAuthOperationError({ code: 'auth/user-not-found' }), {
    message: AUTH_MESSAGES.invalidCredential,
    target: 'form',
  });
  assert.deepStrictEqual(mapAuthOperationError({ code: 'auth/too-many-requests' }), {
    message: AUTH_MESSAGES.tooManyRequests,
    target: 'form',
  });
  assert.deepStrictEqual(mapAuthOperationError(new Error('network details')), {
    message: AUTH_MESSAGES.generic,
    target: 'form',
  });
});

test('change password Firebase errors map to the correct field or form message', () => {
  assert.deepStrictEqual(mapChangePasswordError({ code: 'auth/invalid-credential' }), {
    field: 'currentPassword',
    message: AUTH_MESSAGES.currentPasswordIncorrect,
    target: 'field',
  });
  assert.deepStrictEqual(mapChangePasswordError({ code: 'auth/wrong-password' }), {
    field: 'currentPassword',
    message: AUTH_MESSAGES.currentPasswordIncorrect,
    target: 'field',
  });
  assert.deepStrictEqual(mapChangePasswordError({ code: 'auth/weak-password' }), {
    field: 'newPassword',
    message: AUTH_MESSAGES.passwordTooShort,
    target: 'field',
  });
  assert.deepStrictEqual(mapChangePasswordError({ code: 'auth/too-many-requests' }), {
    message: AUTH_MESSAGES.tooManyRequests,
    target: 'form',
  });
  for (const code of [
    'auth/requires-recent-login',
    'auth/user-mismatch',
    'auth/user-token-expired',
  ]) {
    assert.deepStrictEqual(mapChangePasswordError({ code }), {
      message: AUTH_MESSAGES.recentLoginRequired,
      target: 'form',
    });
  }
  assert.deepStrictEqual(mapChangePasswordError({ code: 'auth/network-request-failed' }), {
    message: AUTH_MESSAGES.networkRequestFailed,
    target: 'form',
  });
  assert.deepStrictEqual(mapChangePasswordError({ code: 'auth/unknown' }), {
    message: AUTH_MESSAGES.generic,
    target: 'form',
  });
});
