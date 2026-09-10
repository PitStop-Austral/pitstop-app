import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { SetActiveVehicleDto } from './dto/set-active-vehicle.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getMe(user: User): Promise<User> {
    if (!user.activeVehicleId) return user;

    const vehicle = await this.usersRepository.findOwnedVehicle(user.activeVehicleId, user.id);
    return vehicle ? user : { ...user, activeVehicleId: null };
  }

  async setActiveVehicle(userId: string, dto: SetActiveVehicleDto): Promise<User> {
    const vehicle = await this.usersRepository.findOwnedVehicle(dto.vehicleId, userId);
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    return this.usersRepository.setActiveVehicle(userId, vehicle.id);
  }
}
