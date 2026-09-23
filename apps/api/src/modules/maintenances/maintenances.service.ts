import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { toMaintenanceResponse } from './maintenances.mapper';
import type { MaintenanceResponse } from './maintenances.mapper';
import { MaintenancesRepository } from './maintenances.repository';
import type { CreateMaintenanceData, MaintenanceView } from './maintenances.repository';

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

  async findByVehicle(ownerId: string, vehicleId: string): Promise<MaintenanceResponse[]> {
    const vehicle = await this.vehiclesRepository.findOwnedById(vehicleId, ownerId);
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    const maintenances = await this.maintenancesRepository.findManyByVehicle(vehicleId);
    return maintenances.map(toMaintenanceResponse);
  }

  async findOne(ownerId: string, vehicleId: string, id: string): Promise<MaintenanceResponse> {
    return toMaintenanceResponse(await this.findOwnedOrThrow(ownerId, vehicleId, id));
  }

  async update(
    ownerId: string,
    vehicleId: string,
    id: string,
    dto: UpdateMaintenanceDto,
  ): Promise<MaintenanceResponse> {
    await this.findOwnedOrThrow(ownerId, vehicleId, id);

    if (dto.date !== undefined && dto.date > argentinaDateToday()) {
      throw new BadRequestException('La fecha no puede ser futura');
    }

    // `!== undefined` rather than `in`: with ES2023 class fields every declared DTO property
    // exists on the instance, so only the value tells a sent field apart from an omitted one.
    const data: Partial<CreateMaintenanceData> = {};
    if (dto.type !== undefined) data.type = dto.type.trim();
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.date !== undefined) data.date = new Date(`${dto.date}T00:00:00.000Z`);
    if (dto.mileage !== undefined) data.mileage = dto.mileage;
    if (dto.workshop !== undefined) data.workshop = dto.workshop?.trim() || null;
    if (dto.cost !== undefined) data.cost = dto.cost;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    try {
      const maintenance = await this.maintenancesRepository.updateWithMileageUpdate(
        vehicleId,
        id,
        data,
      );
      return toMaintenanceResponse(maintenance);
    } catch (error) {
      this.throwIfNotFound(error);
      throw error;
    }
  }

  async remove(ownerId: string, vehicleId: string, id: string): Promise<void> {
    await this.findOwnedOrThrow(ownerId, vehicleId, id);
    try {
      await this.maintenancesRepository.delete(vehicleId, id);
    } catch (error) {
      this.throwIfNotFound(error);
      throw error;
    }
  }

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

  // Scoped by owner and vehicle, so another user's or another vehicle's maintenance is a 404.
  private async findOwnedOrThrow(
    ownerId: string,
    vehicleId: string,
    id: string,
  ): Promise<MaintenanceView> {
    const maintenance = await this.maintenancesRepository.findOwned(ownerId, vehicleId, id);
    if (!maintenance) {
      throw new NotFoundException('Mantenimiento no encontrado');
    }
    return maintenance;
  }

  // The maintenance can be deleted between the ownership check and the write (two tabs, two
  // concurrent DELETEs); Prisma reports that as P2025, which must reach the client as a 404.
  private throwIfNotFound(error: unknown): void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      throw new NotFoundException('Mantenimiento no encontrado');
    }
  }
}
