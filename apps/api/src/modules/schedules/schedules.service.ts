import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { computeScheduleDue } from './schedule-due';
import { toScheduleResponse } from './schedules.mapper';
import type { ScheduleResponse } from './schedules.mapper';
import { SchedulesRepository } from './schedules.repository';
import type { ScheduleView } from './schedules.repository';

type ScheduleOwner = Pick<User, 'id' | 'upcomingThresholdDays' | 'upcomingThresholdKm'>;

// UTC midnight of today's calendar day in Argentina — the date convention schedule-due.ts relies on.
export function argentinaDateToday(): Date {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${date}T00:00:00.000Z`);
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly schedulesRepository: SchedulesRepository,
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async findByVehicle(owner: ScheduleOwner, vehicleId: string): Promise<ScheduleResponse[]> {
    const vehicle = await this.assertOwned(owner.id, vehicleId);
    const schedules = await this.schedulesRepository.findManyByVehicle(vehicleId);
    const today = argentinaDateToday();
    return schedules.map((schedule) => this.toResponse(schedule, owner, vehicle.mileage, today));
  }

  async findOne(
    owner: ScheduleOwner,
    vehicleId: string,
    scheduleId: string,
  ): Promise<ScheduleResponse> {
    const vehicle = await this.assertOwned(owner.id, vehicleId);
    const schedule = await this.findOrThrow(vehicleId, scheduleId);
    return this.toResponse(schedule, owner, vehicle.mileage, argentinaDateToday());
  }

  async create(
    owner: ScheduleOwner,
    vehicleId: string,
    dto: CreateScheduleDto,
  ): Promise<ScheduleResponse> {
    // One "today" for both the baseline fallback and the due calculation, so they can't
    // straddle midnight.
    const today = argentinaDateToday();
    const vehicle = await this.assertOwned(owner.id, vehicleId);
    if (dto.intervalMonths == null && dto.intervalKm == null) {
      throw new BadRequestException('Ingresá meses, kilómetros o ambos');
    }

    const type = dto.type.trim();
    try {
      const schedule = await this.schedulesRepository.createWithBaseline({
        vehicleId,
        type,
        normalizedType: type.toLocaleLowerCase('es-AR'),
        intervalMonths: dto.intervalMonths ?? null,
        intervalKm: dto.intervalKm ?? null,
        fallbackDate: today,
      });
      return this.toResponse(schedule, owner, vehicle.mileage, today);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe una frecuencia para este servicio');
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Vehículo no encontrado');
      }
      throw error;
    }
  }

  async update(
    owner: ScheduleOwner,
    vehicleId: string,
    scheduleId: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleResponse> {
    const today = argentinaDateToday();
    const vehicle = await this.assertOwned(owner.id, vehicleId);

    try {
      const schedule = await this.schedulesRepository.updateWithBaseline({
        id: scheduleId,
        vehicleId,
        fallbackDate: today,
        resolve: (current) => {
          const type = (dto.type ?? current.type).trim();
          const normalizedType = type.toLocaleLowerCase('es-AR');
          const intervalMonths =
            dto.intervalMonths === undefined ? current.intervalMonths : dto.intervalMonths;
          const intervalKm = dto.intervalKm === undefined ? current.intervalKm : dto.intervalKm;

          if (intervalMonths == null && intervalKm == null) {
            throw new BadRequestException('Ingresá meses, kilómetros o ambos');
          }

          return {
            type,
            normalizedType,
            intervalMonths,
            intervalKm,
            resetBaseline: normalizedType !== current.type.toLocaleLowerCase('es-AR'),
          };
        },
      });
      return this.toResponse(schedule, owner, vehicle.mileage, today);
    } catch (error) {
      this.throwMutationError(error);
      throw error;
    }
  }

  async remove(owner: ScheduleOwner, vehicleId: string, scheduleId: string): Promise<void> {
    await this.assertOwned(owner.id, vehicleId);
    await this.findOrThrow(vehicleId, scheduleId);
    try {
      await this.schedulesRepository.delete(vehicleId, scheduleId);
    } catch (error) {
      this.throwMutationError(error);
      throw error;
    }
  }

  private toResponse(
    schedule: ScheduleView,
    owner: ScheduleOwner,
    currentMileage: number,
    today: Date,
  ): ScheduleResponse {
    return toScheduleResponse(
      schedule,
      computeScheduleDue(schedule, {
        currentMileage,
        today,
        thresholdDays: owner.upcomingThresholdDays,
        thresholdKm: owner.upcomingThresholdKm,
      }),
    );
  }

  private async assertOwned(ownerId: string, vehicleId: string): Promise<{ mileage: number }> {
    const vehicle = await this.vehiclesRepository.findOwnedById(vehicleId, ownerId);
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    return vehicle;
  }

  private async findOrThrow(vehicleId: string, scheduleId: string): Promise<ScheduleView> {
    const schedule = await this.schedulesRepository.findById(vehicleId, scheduleId);
    if (!schedule) throw new NotFoundException('Frecuencia no encontrada');
    return schedule;
  }

  private throwMutationError(error: unknown): void {
    if (typeof error !== 'object' || error === null || !('code' in error)) return;
    if (error.code === 'P2002') {
      throw new ConflictException('Ya existe una frecuencia para este servicio');
    }
    if (error.code === 'P2025') {
      throw new NotFoundException('Frecuencia no encontrada');
    }
  }
}
