import { Injectable } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ProfileSummary = {
  vehicleCount: number;
  serviceCount: number;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async syncByFirebaseUid(firebaseUid: string, email: string, name: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { firebaseUid } });

    if (!existing) {
      return this.prisma.user.create({ data: { firebaseUid, email, name } });
    }

    if (existing.email === email) {
      return existing;
    }

    return this.prisma.user.update({ where: { firebaseUid }, data: { email } });
  }

  async getProfileSummary(userId: string): Promise<ProfileSummary> {
    const [vehicleCount, serviceCount] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where: { ownerId: userId } }),
      this.prisma.maintenance.count({ where: { vehicle: { ownerId: userId } } }),
    ]);

    return { vehicleCount, serviceCount };
  }

  async updateName(userId: string, name: string): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { name } });
  }
}
