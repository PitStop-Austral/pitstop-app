import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { argentinaDate } from './schedule-date';
import { normalizeScheduleType } from './schedule-type';

const scheduleSelect = {
  id: true,
  vehicleId: true,
  type: true,
  isDefault: true,
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

export type ScheduleUpdate = Omit<CreateScheduleData, 'vehicleId' | 'fallbackDate'> & {
  resetBaseline: boolean;
};

export type UpdateScheduleData = {
  id: string;
  vehicleId: string;
  fallbackDate: Date;
  resolve: (current: ScheduleView) => ScheduleUpdate;
};

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

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

  findById(vehicleId: string, id: string): Promise<ScheduleView | null> {
    return this.prisma.schedule.findFirst({
      where: { id, vehicleId },
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
        select: { mileage: true },
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
          baselineDate: lastService?.date ?? data.fallbackDate,
          baselineMileage: lastService?.mileage ?? vehicle.mileage,
        },
        select: scheduleSelect,
      });
    });
  }

  async updateWithBaseline(data: UpdateScheduleData): Promise<ScheduleView> {
    for (let attempt = 1; attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const current = await transaction.schedule.findFirstOrThrow({
              where: { id: data.id, vehicleId: data.vehicleId },
              select: scheduleSelect,
            });
            const update = data.resolve(current);
            let baseline: Pick<ScheduleView, 'baselineDate' | 'baselineMileage'> | undefined;

            if (update.resetBaseline) {
              const vehicle = await transaction.vehicle.findUniqueOrThrow({
                where: { id: data.vehicleId },
                select: { mileage: true },
              });
              const lastService = await transaction.maintenance.findFirst({
                where: {
                  vehicleId: data.vehicleId,
                  type: { equals: update.type, mode: 'insensitive' },
                },
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                select: { date: true, mileage: true },
              });
              baseline = {
                baselineDate: lastService?.date ?? data.fallbackDate,
                baselineMileage: lastService?.mileage ?? vehicle.mileage,
              };
            }

            return transaction.schedule.update({
              where: { id: data.id, vehicleId: data.vehicleId },
              data: {
                type: update.type,
                normalizedType: update.normalizedType,
                intervalMonths: update.intervalMonths,
                intervalKm: update.intervalKm,
                ...baseline,
              },
              select: scheduleSelect,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!hasPrismaCode(error, 'P2034') || attempt === SERIALIZABLE_TRANSACTION_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new Error('Unreachable transaction retry state');
  }

  async delete(vehicleId: string, id: string): Promise<void> {
    await this.prisma.schedule.delete({ where: { id, vehicleId } });
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
            baselineDate:
              lastService?.date ??
              (schedule.isDefault
                ? argentinaDate(vehicle.createdAt)
                : argentinaDate(schedule.createdAt)),
            baselineMileage:
              lastService?.mileage ??
              (schedule.isDefault ? (vehicle.initialMileage ?? vehicle.mileage) : vehicle.mileage),
          },
        });
      }),
    );
  }
}
