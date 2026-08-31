import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { User } from '../../generated/prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async syncByFirebaseUid(firebaseUid: string, email: string, name: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { firebaseUid } });

    if (!existing) {
      return this.prisma.user.create({ data: { firebaseUid, email, name } });
    }

    if (existing.email === email && existing.name === name) {
      return existing;
    }

    return this.prisma.user.update({ where: { firebaseUid }, data: { email, name } });
  }
}
