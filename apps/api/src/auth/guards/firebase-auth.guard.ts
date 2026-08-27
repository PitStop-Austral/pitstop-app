import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
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

    try {
      const decodedToken = await this.firebaseService.verifyIdToken(idToken);
      // Upsert runs on every request, not just first login: the ticket requires that a
      // name/email change in Firebase is reflected here on the very next request. Do not
      // gate this behind a "new user" check to save a write.
      request.user = await this.authService.syncUser(decodedToken);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      // Ticket requires every failure to surface as 401, never 500 — but that means an
      // infra/DB failure looks identical to a bad token from the client's point of view.
      // Log the real cause here so we're not blind to it.
      this.logger.error('Firebase auth guard rejected a request', error);
      throw new UnauthorizedException(this.mapFirebaseError(error));
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }

  private mapFirebaseError(error: unknown): string {
    if (error instanceof FirebaseAuthError) {
      const code = Object.keys(UNAUTHORIZED_MESSAGES).find((c) => error.hasCode(c));
      if (code) return UNAUTHORIZED_MESSAGES[code];
    }
    return 'Invalid or missing token';
  }
}
