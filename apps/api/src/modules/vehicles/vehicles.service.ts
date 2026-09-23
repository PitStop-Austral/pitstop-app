import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { SetVehiclePhotoDto } from './dto/set-vehicle-photo.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateVehicleData, UpdateVehicleData, VehiclesRepository } from './vehicles.repository';
import { toVehicleResponse } from './vehicles.mapper';
import type { VehicleResponse } from './vehicles.mapper';
import { normalizeVehiclePlate } from './vehicle-normalization';

function normalizeOptionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly vehiclesRepository: VehiclesRepository,
    private readonly firebaseService: FirebaseService,
  ) {}

  async findByOwner(ownerId: string): Promise<VehicleResponse[]> {
    const vehicles = await this.vehiclesRepository.findByOwner(ownerId);
    return vehicles.map(toVehicleResponse);
  }

  async create(ownerId: string, dto: CreateVehicleDto): Promise<VehicleResponse> {
    const data: CreateVehicleData = {
      brand: dto.brand.trim(),
      model: dto.model.trim(),
      year: dto.year,
      fuel: dto.fuel,
      plate: normalizeVehiclePlate(dto.plate),
      mileage: dto.mileage,
      nickname: normalizeOptionalText(dto.nickname),
      engineOilType: normalizeOptionalText(dto.engineOilType),
      engineOilLiters: dto.engineOilLiters ?? null,
      gearboxOilType: normalizeOptionalText(dto.gearboxOilType),
      gearboxOilLiters: dto.gearboxOilLiters ?? null,
      transmission: dto.transmission ?? null,
      frontTireSize: normalizeOptionalText(dto.frontTireSize),
      frontTirePressurePsi: dto.frontTirePressurePsi ?? null,
      rearTireSize: normalizeOptionalText(dto.rearTireSize),
      rearTirePressurePsi: dto.rearTirePressurePsi ?? null,
      highBeam: normalizeOptionalText(dto.highBeam),
      lowBeam: normalizeOptionalText(dto.lowBeam),
      fogLight: normalizeOptionalText(dto.fogLight),
    };

    try {
      const vehicle = await this.vehiclesRepository.createAndSetActive(ownerId, data);
      return toVehicleResponse(vehicle);
    } catch (error) {
      this.throwIfDuplicatePlate(error);
      throw error;
    }
  }

  async update(ownerId: string, id: string, dto: UpdateVehicleDto): Promise<VehicleResponse> {
    const ownedVehicle = await this.vehiclesRepository.findOwnedById(id, ownerId);
    if (!ownedVehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    const data = this.normalizeUpdate(dto);

    try {
      const vehicle = await this.vehiclesRepository.update(id, data);
      return toVehicleResponse(vehicle);
    } catch (error) {
      this.throwIfDuplicatePlate(error);
      throw error;
    }
  }

  async updateMileage(ownerId: string, id: string, mileage: number): Promise<VehicleResponse> {
    const updatedVehicle = await this.vehiclesRepository.updateMileageIfNotDecreased(
      id,
      ownerId,
      mileage,
    );
    if (updatedVehicle) return toVehicleResponse(updatedVehicle);

    const ownedVehicle = await this.vehiclesRepository.findOwnedById(id, ownerId);
    if (!ownedVehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    throw new BadRequestException(
      `No puede ser menor a ${ownedVehicle.mileage.toLocaleString('es-AR')} km`,
    );
  }

  async setPhoto(
    user: Pick<User, 'id' | 'firebaseUid'>,
    id: string,
    dto: SetVehiclePhotoDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.vehiclesRepository.findOwnedById(id, user.id);
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    if (!dto.photoPath.startsWith(`${user.firebaseUid}/vehicles/${id}/`)) {
      throw new BadRequestException('La foto no pertenece a este vehículo');
    }

    if (new URL(dto.photoUrl).hostname !== 'firebasestorage.googleapis.com') {
      throw new BadRequestException('La URL de la foto no es válida');
    }

    const updatedVehicle = await this.vehiclesRepository.setPhoto(id, dto.photoPath, dto.photoUrl);

    if (vehicle.photoPath && vehicle.photoPath !== dto.photoPath) {
      await this.deleteFileSafely(vehicle.photoPath);
    }

    return toVehicleResponse(updatedVehicle);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const ownedVehicle = await this.vehiclesRepository.findOwnedById(id, ownerId);
    if (!ownedVehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    await this.vehiclesRepository.deleteAndReassignActive(ownerId, id);
    if (ownedVehicle.photoPath) {
      await this.deleteFileSafely(ownedVehicle.photoPath);
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
    if (dto.nickname !== undefined) data.nickname = normalizeOptionalText(dto.nickname);
    if (dto.engineOilType !== undefined)
      data.engineOilType = normalizeOptionalText(dto.engineOilType);
    if (dto.engineOilLiters !== undefined) data.engineOilLiters = dto.engineOilLiters;
    if (dto.gearboxOilType !== undefined)
      data.gearboxOilType = normalizeOptionalText(dto.gearboxOilType);
    if (dto.gearboxOilLiters !== undefined) data.gearboxOilLiters = dto.gearboxOilLiters;
    if (dto.transmission !== undefined) data.transmission = dto.transmission;
    if (dto.frontTireSize !== undefined)
      data.frontTireSize = normalizeOptionalText(dto.frontTireSize);
    if (dto.frontTirePressurePsi !== undefined)
      data.frontTirePressurePsi = dto.frontTirePressurePsi;
    if (dto.rearTireSize !== undefined) data.rearTireSize = normalizeOptionalText(dto.rearTireSize);
    if (dto.rearTirePressurePsi !== undefined) data.rearTirePressurePsi = dto.rearTirePressurePsi;
    if (dto.highBeam !== undefined) data.highBeam = normalizeOptionalText(dto.highBeam);
    if (dto.lowBeam !== undefined) data.lowBeam = normalizeOptionalText(dto.lowBeam);
    if (dto.fogLight !== undefined) data.fogLight = normalizeOptionalText(dto.fogLight);
    return data;
  }

  private throwIfDuplicatePlate(error: unknown): void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('Ya existe un vehículo con esa patente');
    }
  }

  private async deleteFileSafely(path: string): Promise<void> {
    try {
      await this.firebaseService.deleteFile(path);
    } catch (error) {
      this.logger.error(
        `Failed to delete vehicle photo at ${path}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
