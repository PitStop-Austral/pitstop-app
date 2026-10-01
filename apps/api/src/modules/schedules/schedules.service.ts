import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { argentinaDateToday } from './schedule-date';
import { computeScheduleDue } from './schedule-due';
import { toScheduleResponse } from './schedules.mapper';
import type { ScheduleResponse } from './schedules.mapper';
import { SchedulesRepository } from './schedules.repository';
import type { ScheduleView } from './schedules.repository';
import { normalizeScheduleType } from './schedule-type';

type ScheduleOwner = Pick<User, 'id' | 'upcomingThresholdDays' | 'upcomingThresholdKm'>;

export { argentinaDateToday } from './schedule-date';

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

  async create(
    owner: ScheduleOwner,
    vehicleId: string,
    dto: CreateScheduleDto,
  ): Promise<ScheduleResponse> {
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
        normalizedType: normalizeScheduleType(type),
        intervalMonths: dto.intervalMonths ?? null,
        intervalKm: dto.intervalKm ?? null,
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

  async findRelated(
    owner: ScheduleOwner,
    vehicleId: string,
    type: string,
  ): Promise<ScheduleResponse | null> {
    const vehicle = await this.assertOwned(owner.id, vehicleId);
    const schedule = await this.schedulesRepository.findByVehicleAndNormalizedType(
      vehicleId,
      normalizeScheduleType(type),
    );
    return schedule
      ? this.toResponse(schedule, owner, vehicle.mileage, argentinaDateToday())
      : null;
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
}
