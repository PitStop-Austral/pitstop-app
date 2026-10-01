import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { argentinaDate } from './schedule-date';
import { normalizeScheduleType } from './schedule-type';

const scheduleSelect = {
  id: true,
  vehicleId: true,
  type: true,
  intervalMonths: true,
  intervalKm: true,
  baselineDate: true,
  baselineMileage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ScheduleSelect;

export type ScheduleView = Prisma.ScheduleGetPayload<{ select: typeof scheduleSelect }>;

export type CreateScheduleData = {
  vehicleId: string;
  type: string;
  normalizedType: string;
  intervalMonths: number | null;
  intervalKm: number | null;
};

@Injectable()
export class SchedulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByVehicle(vehicleId: string): Promise<ScheduleView[]> {
    return this.prisma.schedule.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      select: scheduleSelect,
    });
  }

  findByVehicleAndNormalizedType(
    vehicleId: string,
    normalizedType: string,
  ): Promise<ScheduleView | null> {
    return this.prisma.schedule.findUnique({
      where: { vehicleId_normalizedType: { vehicleId, normalizedType } },
      select: scheduleSelect,
    });
  }

  createWithBaseline(data: CreateScheduleData): Promise<ScheduleView> {
    return this.prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.findUniqueOrThrow({
        where: { id: data.vehicleId },
        select: { createdAt: true, initialMileage: true, mileage: true },
      });
      const lastService = await transaction.maintenance.findFirst({
        where: { vehicleId: data.vehicleId, type: { equals: data.type, mode: 'insensitive' } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: { date: true, mileage: true },
      });

      return transaction.schedule.create({
        data: {
          vehicleId: data.vehicleId,
          type: data.type,
          normalizedType: data.normalizedType,
          intervalMonths: data.intervalMonths,
          intervalKm: data.intervalKm,
          baselineDate: lastService?.date ?? argentinaDate(vehicle.createdAt),
          baselineMileage: lastService?.mileage ?? vehicle.initialMileage ?? vehicle.mileage,
        },
        select: scheduleSelect,
      });
    });
  }

  async recalculateBaselines(
    transaction: Prisma.TransactionClient,
    vehicleId: string,
    types: readonly string[],
  ): Promise<void> {
    const normalizedTypes = [...new Set(types.map(normalizeScheduleType))];
    const schedules = await transaction.schedule.findMany({
      where: { vehicleId, normalizedType: { in: normalizedTypes } },
      select: scheduleSelect,
    });
    if (!schedules.length) return;

    const vehicle = await transaction.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
      select: { createdAt: true, initialMileage: true, mileage: true },
    });
    await Promise.all(
      schedules.map(async (schedule) => {
        const lastService = await transaction.maintenance.findFirst({
          where: { vehicleId, type: { equals: schedule.type, mode: 'insensitive' } },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          select: { date: true, mileage: true },
        });
        await transaction.schedule.update({
          where: { id: schedule.id },
          data: {
            baselineDate: lastService?.date ?? argentinaDate(vehicle.createdAt),
            baselineMileage: lastService?.mileage ?? vehicle.initialMileage ?? vehicle.mileage,
          },
        });
      }),
    );
  }
}
