import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { SetActiveVehicleDto } from './dto/set-active-vehicle.dto';

@Injectable()
export class UsersService {
  constructor(private readonly vehiclesRepository: VehiclesRepository) {}

  async getMe(user: User): Promise<User> {
    if (!user.activeVehicleId) return user;

    const vehicle = await this.vehiclesRepository.findOwnedById(user.activeVehicleId, user.id);
    return vehicle ? user : { ...user, activeVehicleId: null };
  }

  async setActiveVehicle(userId: string, dto: SetActiveVehicleDto): Promise<User> {
    const vehicle = await this.vehiclesRepository.findOwnedById(dto.vehicleId, userId);
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    return this.vehiclesRepository.setActiveVehicle(userId, vehicle.id);
  }
}
