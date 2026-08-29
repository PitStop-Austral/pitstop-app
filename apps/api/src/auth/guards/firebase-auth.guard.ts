import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthError } from 'firebase-admin/auth';
import { FirebaseService } from '../../firebase/firebase.service';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const UNAUTHORIZED_MESSAGES: Record<string, string> = {
  'id-token-expired': 'Token expired',
  'id-token-revoked': 'Token revoked, re-authenticate',
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebaseService: FirebaseService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const idToken = this.extractToken(request);
    if (!idToken) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    const decodedToken = await this.verifyToken(idToken);

    // AuthService.syncUser runs on every request, not just first login, so a name/email
    // change in Firebase is reflected here on the very next request. UsersRepository only
    // writes to the DB when email/name actually changed, so the common case (nothing
    // changed) costs a single read, not a write.
    try {
      request.user = await this.authService.syncUser(decodedToken);
    } catch (error) {
      // AuthService itself throws UnauthorizedException for a genuinely bad token (e.g.
      // missing email) — that's still a 401. Anything else here is a DB/infra failure, not
      // an invalid credential: log it and let it propagate as a 5xx instead of masking it
      // as "invalid token", or a real outage would look identical to an expired session.
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error('Failed to sync Firebase user to the database', error);
      throw error;
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }

  private async verifyToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await this.firebaseService.verifyIdToken(idToken);
    } catch (error) {
      // Ticket requires every token-verification failure to surface as 401, never 500.
      this.logger.error('Firebase ID token verification failed', error);
      throw new UnauthorizedException(this.mapFirebaseError(error));
    }
  }

  private mapFirebaseError(error: unknown): string {
    if (error instanceof FirebaseAuthError) {
      const code = Object.keys(UNAUTHORIZED_MESSAGES).find((c) => error.hasCode(c));
      if (code) return UNAUTHORIZED_MESSAGES[code];
    }
    return 'Invalid or missing token';
  }
}
