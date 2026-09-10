import { Injectable } from '@nestjs/common';
import { FuelType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const vehicleSelect = {
  id: true,
  brand: true,
  model: true,
  year: true,
  fuel: true,
  plate: true,
  mileage: true,
  nickname: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleSelect;

export type VehicleView = Prisma.VehicleGetPayload<{ select: typeof vehicleSelect }>;

export type CreateVehicleData = {
  brand: string;
  model: string;
  year: number;
  fuel: FuelType;
  plate: string;
  mileage: number;
  nickname: string | null;
};

export type UpdateVehicleData = Partial<CreateVehicleData>;

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOwner(ownerId: string): Promise<VehicleView[]> {
    return this.prisma.vehicle.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      select: vehicleSelect,
    });
  }

  async findOwnedById(id: string, ownerId: string): Promise<{ id: string } | null> {
    return this.prisma.vehicle.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
  }

  async createAndSetActive(ownerId: string, data: CreateVehicleData): Promise<VehicleView> {
    return this.prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.create({
        data: { ...data, ownerId },
        select: vehicleSelect,
      });

      await transaction.user.update({
        where: { id: ownerId },
        data: { activeVehicleId: vehicle.id },
      });

      return vehicle;
    });
  }

  async update(id: string, data: UpdateVehicleData): Promise<VehicleView> {
    return this.prisma.vehicle.update({
      where: { id },
      data,
      select: vehicleSelect,
    });
  }

  async deleteAndReassignActive(ownerId: string, vehicleId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT 1 FROM "User" WHERE id = ${ownerId} FOR UPDATE`;

      const user = await transaction.user.findUnique({
        where: { id: ownerId },
        select: { activeVehicleId: true },
      });

      await transaction.vehicle.delete({ where: { id: vehicleId } });

      if (user?.activeVehicleId !== vehicleId) return;

      const replacement = await transaction.vehicle.findFirst({
        where: { ownerId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      await transaction.user.update({
        where: { id: ownerId },
        data: { activeVehicleId: replacement?.id ?? null },
      });
    });
  }
}
