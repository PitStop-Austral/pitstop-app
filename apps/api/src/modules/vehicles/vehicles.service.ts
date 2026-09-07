import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import {
  CreateVehicleData,
  UpdateVehicleData,
  VehiclesRepository,
  VehicleView,
} from './vehicles.repository';
import { normalizeVehiclePlate } from './vehicle-normalization';

@Injectable()
export class VehiclesService {
  constructor(private readonly vehiclesRepository: VehiclesRepository) {}

  async findByOwner(ownerId: string): Promise<VehicleView[]> {
    return this.vehiclesRepository.findByOwner(ownerId);
  }

  async create(ownerId: string, dto: CreateVehicleDto): Promise<VehicleView> {
    const data: CreateVehicleData = {
      brand: dto.brand.trim(),
      model: dto.model.trim(),
      year: dto.year,
      fuel: dto.fuel,
      plate: normalizeVehiclePlate(dto.plate),
      mileage: dto.mileage,
      nickname: dto.nickname?.trim() || null,
    };

    try {
      return await this.vehiclesRepository.createAndSetActive(ownerId, data);
    } catch (error) {
      this.throwIfDuplicatePlate(error);
      throw error;
    }
  }

  async update(ownerId: string, id: string, dto: UpdateVehicleDto): Promise<VehicleView> {
    const ownedVehicle = await this.vehiclesRepository.findOwnedById(id, ownerId);
    if (!ownedVehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    const data = this.normalizeUpdate(dto);

    try {
      return await this.vehiclesRepository.update(id, data);
    } catch (error) {
      this.throwIfDuplicatePlate(error);
      throw error;
    }
  }

  private normalizeUpdate(dto: UpdateVehicleDto): UpdateVehicleData {
    const data: UpdateVehicleData = {};
    if (dto.brand !== undefined) data.brand = dto.brand.trim();
    if (dto.model !== undefined) data.model = dto.model.trim();
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.fuel !== undefined) data.fuel = dto.fuel;
    if (dto.plate !== undefined) data.plate = normalizeVehiclePlate(dto.plate);
    if (dto.mileage !== undefined) data.mileage = dto.mileage;
    if (dto.nickname !== undefined) data.nickname = dto.nickname?.trim() || null;
    return data;
  }

  private throwIfDuplicatePlate(error: unknown): void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('Ya existe un vehículo con esa patente');
    }
  }
}
