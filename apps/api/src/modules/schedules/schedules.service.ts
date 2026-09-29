import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { toScheduleResponse } from './schedules.mapper';
import type { ScheduleResponse } from './schedules.mapper';
import { SchedulesRepository } from './schedules.repository';

function argentinaDateToday(): Date {
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

  async findByVehicle(ownerId: string, vehicleId: string): Promise<ScheduleResponse[]> {
    await this.assertOwned(ownerId, vehicleId);
    const schedules = await this.schedulesRepository.findManyByVehicle(vehicleId);
    return schedules.map(toScheduleResponse);
  }

  async create(
    ownerId: string,
    vehicleId: string,
    dto: CreateScheduleDto,
  ): Promise<ScheduleResponse> {
    await this.assertOwned(ownerId, vehicleId);
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
        fallbackDate: argentinaDateToday(),
      });
      return toScheduleResponse(schedule);
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

  private async assertOwned(ownerId: string, vehicleId: string): Promise<void> {
    const vehicle = await this.vehiclesRepository.findOwnedById(vehicleId, ownerId);
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
  }
}
