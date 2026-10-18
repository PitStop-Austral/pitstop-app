import { Injectable } from '@nestjs/common';
import { FuelType, Prisma, TransmissionType, User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { argentinaDate } from '../schedules/schedule-date';
import { DEFAULT_SCHEDULES, normalizeScheduleType } from '../schedules/schedule-type';
import {
  cancelAlertCycles,
  lockVehicleSchedules,
  observeAlertMileage,
} from '../maintenance-alerts/alert-cycle-evidence.repository';

const vehicleSelect = {
  id: true,
  brand: true,
  model: true,
  year: true,
  fuel: true,
  plate: true,
  mileage: true,
  nickname: true,
  engineOilType: true,
  engineOilLiters: true,
  gearboxOilType: true,
  gearboxOilLiters: true,
  transmission: true,
  frontTireSize: true,
  frontTirePressurePsi: true,
  rearTireSize: true,
  rearTirePressurePsi: true,
  highBeam: true,
  lowBeam: true,
  fogLight: true,
  photoUrl: true,
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
  engineOilType: string | null;
  engineOilLiters: number | null;
  gearboxOilType: string | null;
  gearboxOilLiters: number | null;
  transmission: TransmissionType | null;
  frontTireSize: string | null;
  frontTirePressurePsi: number | null;
  rearTireSize: string | null;
  rearTirePressurePsi: number | null;
  highBeam: string | null;
  lowBeam: string | null;
  fogLight: string | null;
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

  async findOwnedById(
    id: string,
    ownerId: string,
  ): Promise<{ id: string; mileage: number; photoPath: string | null } | null> {
    return this.prisma.vehicle.findFirst({
      where: { id, ownerId },
      select: { id: true, mileage: true, photoPath: true },
    });
  }

  async setActiveVehicle(ownerId: string, vehicleId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: ownerId },
      data: { activeVehicleId: vehicleId },
    });
  }

  async createAndSetActive(ownerId: string, data: CreateVehicleData): Promise<VehicleView> {
    return this.prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.create({
        data: { ...data, ownerId, initialMileage: data.mileage },
        select: vehicleSelect,
      });

      await transaction.schedule.createMany({
        data: DEFAULT_SCHEDULES.map((schedule) => ({
          ...schedule,
          vehicleId: vehicle.id,
          isDefault: true,
          normalizedType: normalizeScheduleType(schedule.type),
          baselineDate: argentinaDate(vehicle.createdAt),
          baselineMileage: data.mileage,
        })),
      });

      await transaction.user.update({
        where: { id: ownerId },
        data: { activeVehicleId: vehicle.id },
      });

      return vehicle;
    });
  }

  async update(id: string, data: UpdateVehicleData): Promise<VehicleView> {
    return this.prisma.$transaction(async (transaction) => {
      if (data.mileage !== undefined) await lockVehicleSchedules(transaction, id);
      const vehicle = await transaction.vehicle.update({
        where: { id },
        data,
        select: vehicleSelect,
      });
      if (data.mileage !== undefined) {
        await observeAlertMileage(transaction, id, data.mileage, new Date());
      }
      return vehicle;
    });
  }

  async setPhoto(id: string, photoPath: string, photoUrl: string): Promise<VehicleView> {
    return this.prisma.vehicle.update({
      where: { id },
      data: { photoPath, photoUrl },
      select: vehicleSelect,
    });
  }

  async updateMileageIfNotDecreased(
    id: string,
    ownerId: string,
    mileage: number,
  ): Promise<VehicleView | null> {
    return this.prisma.$transaction(async (transaction) => {
      await lockVehicleSchedules(transaction, id);
      const [vehicle] = await transaction.vehicle.updateManyAndReturn({
        where: { id, ownerId, mileage: { lte: mileage } },
        data: { mileage },
        select: vehicleSelect,
      });
      if (vehicle) await observeAlertMileage(transaction, id, mileage, new Date());
      return vehicle ?? null;
    });
  }

  async deleteAndReassignActive(ownerId: string, vehicleId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT 1 FROM "User" WHERE id = ${ownerId} FOR UPDATE`;
      await lockVehicleSchedules(transaction, vehicleId);
      await cancelAlertCycles(transaction, { vehicleId }, new Date());

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
