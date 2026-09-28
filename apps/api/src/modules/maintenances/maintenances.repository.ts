import { Injectable } from '@nestjs/common';
import { MaintenanceCategory, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const maintenanceSelect = {
  id: true,
  vehicleId: true,
  type: true,
  category: true,
  date: true,
  mileage: true,
  workshop: true,
  cost: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MaintenanceSelect;

export type MaintenanceView = Prisma.MaintenanceGetPayload<{
  select: typeof maintenanceSelect;
}>;

export type CreateMaintenanceData = {
  type: string;
  category: MaintenanceCategory;
  date: Date;
  mileage: number;
  workshop: string | null;
  cost: number | null;
  notes: string | null;
};

@Injectable()
export class MaintenancesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByVehicle(vehicleId: string): Promise<MaintenanceView[]> {
    return this.prisma.maintenance.findMany({
      where: { vehicleId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: maintenanceSelect,
    });
  }

  async findOwned(ownerId: string, vehicleId: string, id: string): Promise<MaintenanceView | null> {
    return this.prisma.maintenance.findFirst({
      where: { id, vehicleId, vehicle: { ownerId } },
      select: maintenanceSelect,
    });
  }

  async updateWithMileageUpdate(
    vehicleId: string,
    id: string,
    data: Partial<CreateMaintenanceData>,
  ): Promise<MaintenanceView> {
    return this.prisma.$transaction(async (transaction) => {
      const maintenance = await transaction.maintenance.update({
        where: { id, vehicleId },
        data,
        select: maintenanceSelect,
      });

      if (data.mileage !== undefined) {
        await transaction.vehicle.updateMany({
          where: { id: vehicleId, mileage: { lt: data.mileage } },
          data: { mileage: data.mileage },
        });
      }

      return maintenance;
    });
  }

  async delete(vehicleId: string, id: string): Promise<void> {
    await this.prisma.maintenance.delete({ where: { id, vehicleId } });
  }

  async createWithMileageUpdate(
    vehicleId: string,
    data: CreateMaintenanceData,
  ): Promise<MaintenanceView> {
    return this.prisma.$transaction(async (transaction) => {
      const maintenance = await transaction.maintenance.create({
        data: { ...data, vehicleId },
        select: maintenanceSelect,
      });

      await transaction.vehicle.updateMany({
        where: { id: vehicleId, mileage: { lt: data.mileage } },
        data: { mileage: data.mileage },
      });

      return maintenance;
    });
  }
}
