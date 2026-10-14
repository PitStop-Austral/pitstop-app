import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CronSecretGuard } from './cron-secret.guard';

function contextWithAuthorization(authorization?: string): ExecutionContext {
  const request = { headers: { authorization } } as Request;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe('CronSecretGuard', () => {
  const guard = new CronSecretGuard();

  beforeEach(() => {
    process.env.CRON_SECRET = 'a'.repeat(64);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it.each([
    undefined,
    '',
    'Basic credentials',
    'Bearer ',
    'Bearer wrong',
    `Bearer ${'b'.repeat(64)}`,
  ])('rejects an invalid Authorization header: %s', (authorization) => {
    expect(() => guard.canActivate(contextWithAuthorization(authorization))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;

    expect(() => guard.canActivate(contextWithAuthorization(`Bearer ${'a'.repeat(64)}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts the exact Bearer secret', () => {
    expect(guard.canActivate(contextWithAuthorization(`Bearer ${'a'.repeat(64)}`))).toBe(true);
  });
});
