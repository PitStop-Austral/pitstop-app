import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
  fallbackDate: Date;
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

  createWithBaseline(data: CreateScheduleData): Promise<ScheduleView> {
    return this.prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.findUniqueOrThrow({
        where: { id: data.vehicleId },
        select: { mileage: true },
      });
      const lastService = await transaction.maintenance.findFirst({
        where: { vehicleId: data.vehicleId, type: { equals: data.type, mode: 'insensitive' } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { date: true, mileage: true },
      });

      return transaction.schedule.create({
        data: {
          vehicleId: data.vehicleId,
          type: data.type,
          normalizedType: data.normalizedType,
          intervalMonths: data.intervalMonths,
          intervalKm: data.intervalKm,
          baselineDate: lastService?.date ?? data.fallbackDate,
          baselineMileage: lastService?.mileage ?? vehicle.mileage,
        },
        select: scheduleSelect,
      });
    });
  }
}
