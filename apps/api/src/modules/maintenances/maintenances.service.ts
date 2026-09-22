import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { toMaintenanceResponse } from './maintenances.mapper';
import type { MaintenanceResponse } from './maintenances.mapper';
import { MaintenancesRepository } from './maintenances.repository';

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function argentinaDateToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

@Injectable()
export class MaintenancesService {
  constructor(
    private readonly maintenancesRepository: MaintenancesRepository,
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async create(
    ownerId: string,
    vehicleId: string,
    dto: CreateMaintenanceDto,
  ): Promise<MaintenanceResponse> {
    const vehicle = await this.vehiclesRepository.findOwnedById(vehicleId, ownerId);
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    if (dto.date > argentinaDateToday()) {
      throw new BadRequestException('La fecha no puede ser futura');
    }

    const maintenance = await this.maintenancesRepository.createWithMileageUpdate(vehicleId, {
      type: dto.type.trim(),
      category: dto.category,
      date: new Date(`${dto.date}T00:00:00.000Z`),
      mileage: dto.mileage,
      workshop: dto.workshop?.trim() || null,
      cost: dto.cost ?? null,
      notes: dto.notes?.trim() || null,
    });

    return toMaintenanceResponse(maintenance);
  }
}
