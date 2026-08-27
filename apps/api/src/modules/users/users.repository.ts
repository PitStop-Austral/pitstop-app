import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { User } from '../../generated/prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertByFirebaseUid(firebaseUid: string, email: string, name: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { firebaseUid },
      update: { email, name },
      create: { firebaseUid, email, name },
    });
  }
}
