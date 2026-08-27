import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '../generated/prisma/client';
import { UsersRepository } from '../modules/users/users.repository';

@Injectable()
export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async syncUser(decodedToken: DecodedIdToken): Promise<User> {
    const { uid, email } = decodedToken;
    if (!email) {
      throw new UnauthorizedException('Invalid or missing token');
    }
    const name = decodedToken.name ?? email.split('@')[0];
    return this.usersRepository.upsertByFirebaseUid(uid, email, name);
  }
}
