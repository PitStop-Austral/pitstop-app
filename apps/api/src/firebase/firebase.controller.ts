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
      if (error instanceof FirebaseAuthError) {
        throw new UnauthorizedException('Invalid or expired Firebase ID token');
      }
      this.logger.error('Unexpected error verifying Firebase ID token', error);
      throw new InternalServerErrorException('Could not verify Firebase ID token');
    }
  }
}
