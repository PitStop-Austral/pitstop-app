import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { SetActiveVehicleDto } from './dto/set-active-vehicle.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ProfileSummary, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

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

  getProfileSummary(userId: string): Promise<ProfileSummary> {
    return this.usersRepository.getProfileSummary(userId);
  }

  updateMe(userId: string, dto: UpdateMeDto): Promise<User> {
    return this.usersRepository.updateName(userId, dto.name);
  }
}
