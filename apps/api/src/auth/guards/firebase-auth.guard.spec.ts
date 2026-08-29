import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthError } from 'firebase-admin/auth';
import { FirebaseService } from '../../firebase/firebase.service';
import { AuthService } from '../auth.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

// firebase-admin/auth pulls in the ESM-only `jose` package, which Jest's module loader cannot
// transform. Mock it so this spec never touches the real firebase-admin/auth module graph.
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
  FirebaseAuthError: class FirebaseAuthError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = `auth/${code}`;
    }
    hasCode(code: string) {
      return this.code === code || this.code === `auth/${code}`;
    }
  },
}));

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let firebaseService: { verifyIdToken: jest.Mock };
  let authService: { syncUser: jest.Mock };

  const createContext = (headers: Record<string, string> = {}) => {
    const request = { headers } as unknown as { headers: Record<string, string>; user?: unknown };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    firebaseService = { verifyIdToken: jest.fn() };
    authService = { syncUser: jest.fn() };
    guard = new FirebaseAuthGuard(
      reflector as unknown as Reflector,
      firebaseService as unknown as FirebaseService,
      authService as unknown as AuthService,
    );
  });

  it('allows public routes without touching Firebase or the auth service', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(firebaseService.verifyIdToken).not.toHaveBeenCalled();
    expect(authService.syncUser).not.toHaveBeenCalled();
  });

  it('rejects when the Authorization header is missing', async () => {
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const { context } = createContext({ authorization: 'Basic abc' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('maps an expired token to "Token expired"', async () => {
    firebaseService.verifyIdToken.mockRejectedValue(
      new FirebaseAuthError({ code: 'id-token-expired', message: 'expired' }),
    );
    const { context } = createContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow('Token expired');
  });

  it('maps a revoked token to "Token revoked, re-authenticate"', async () => {
    firebaseService.verifyIdToken.mockRejectedValue(
      new FirebaseAuthError({ code: 'id-token-revoked', message: 'revoked' }),
    );
    const { context } = createContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow('Token revoked, re-authenticate');
  });

  it('maps any other Firebase error to "Invalid or missing token"', async () => {
    firebaseService.verifyIdToken.mockRejectedValue(
      new FirebaseAuthError({ code: 'argument-error', message: 'bad argument' }),
    );
    const { context } = createContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow('Invalid or missing token');
  });

  it('never lets a non-Firebase error escape as an unhandled exception', async () => {
    firebaseService.verifyIdToken.mockRejectedValue(new Error('network unreachable'));
    const { context } = createContext({ authorization: 'Bearer some-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the synced user to the request and allows the request through', async () => {
    const decodedToken = { uid: 'uid-1', email: 'a@b.com', name: 'Ada' };
    const user = { id: 'uuid-1', firebaseUid: 'uid-1', email: 'a@b.com', name: 'Ada' };
    firebaseService.verifyIdToken.mockResolvedValue(decodedToken);
    authService.syncUser.mockResolvedValue(user);
    const { context, request } = createContext({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.syncUser).toHaveBeenCalledWith(decodedToken);
    expect(request.user).toBe(user);
  });

  it('propagates a syncUser/DB failure instead of masking it as 401', async () => {
    firebaseService.verifyIdToken.mockResolvedValue({ uid: 'uid-1', email: 'a@b.com' });
    const dbError = new Error('connection to database failed');
    authService.syncUser.mockRejectedValue(dbError);
    const { context } = createContext({ authorization: 'Bearer good-token' });

    let thrown: unknown;
    try {
      await guard.canActivate(context);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(dbError);
    expect(thrown).not.toBeInstanceOf(UnauthorizedException);
  });
});
