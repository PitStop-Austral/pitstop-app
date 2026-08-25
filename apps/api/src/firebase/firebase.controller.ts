import {
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAuthError } from 'firebase-admin/auth';

import { FirebaseService } from './firebase.service';

// Firebase Auth error codes that mean "the token itself is invalid, malformed, or expired" —
// as opposed to a FirebaseAuthError caused by an infrastructure failure (e.g. not being able to
// fetch Google's public keys), which should surface as a 500, not a 401.
const INVALID_TOKEN_ERROR_CODES = [
  'id-token-expired',
  'id-token-revoked',
  'argument-error',
  'invalid-id-token',
];

// PIT-22 disposable test endpoint — delete once the real auth guard ticket lands.
@Controller('firebase')
export class FirebaseController {
  private readonly logger = new Logger(FirebaseController.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  @Get('whoami')
  async whoami(@Headers('authorization') authHeader?: string): Promise<{ uid: string }> {
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!idToken) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const decoded = await this.firebaseService.verifyIdToken(idToken);
      return { uid: decoded.uid };
    } catch (error) {
      const isInvalidToken =
        error instanceof FirebaseAuthError &&
        INVALID_TOKEN_ERROR_CODES.some((code) => error.hasCode(code));

      if (isInvalidToken) {
        throw new UnauthorizedException('Invalid or expired Firebase ID token');
      }
      this.logger.error('Unexpected error verifying Firebase ID token', error);
      throw new InternalServerErrorException('Could not verify Firebase ID token');
    }
  }
}
