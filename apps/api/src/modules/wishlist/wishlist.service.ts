import { Injectable, NotFoundException } from '@nestjs/common';
import { WishlistPriority } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { toWishlistItemResponse } from './wishlist.mapper';
import type { WishlistItemResponse } from './wishlist.mapper';
import { WishlistRepository } from './wishlist.repository';

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
    private readonly vehiclesRepository: VehiclesRepository,
  ) {}

  async findByVehicle(ownerId: string, vehicleId: string): Promise<WishlistItemResponse[]> {
    await this.assertOwnedVehicle(ownerId, vehicleId);
    const items = await this.wishlistRepository.findManyByVehicle(vehicleId);
    return items.map(toWishlistItemResponse);
  }

  async create(
    ownerId: string,
    vehicleId: string,
    dto: CreateWishlistItemDto,
  ): Promise<WishlistItemResponse> {
    await this.assertOwnedVehicle(ownerId, vehicleId);
    try {
      const item = await this.wishlistRepository.create(vehicleId, {
        name: dto.name.trim(),
        estimatedPrice: dto.estimatedPrice ?? null,
        priority: dto.priority ?? WishlistPriority.MEDIA,
        note: dto.note?.trim() || null,
      });
      return toWishlistItemResponse(item);
    } catch (error) {
      this.throwIfVehicleGone(error);
      throw error;
    }
  }

  async setPurchased(
    ownerId: string,
    vehicleId: string,
    id: string,
    purchased: boolean,
  ): Promise<WishlistItemResponse> {
    await this.assertOwnedVehicle(ownerId, vehicleId);
    await this.wishlistRepository.setPurchased(
      vehicleId,
      id,
      purchased,
      purchased ? new Date() : null,
    );
    // Re-read whether or not the write matched: an item that already had this state is returned
    // as is (keeping its original purchase date), and a missing one is a 404.
    const item = await this.wishlistRepository.findByVehicle(vehicleId, id);
    if (!item) {
      throw new NotFoundException('Deseo no encontrado');
    }
    return toWishlistItemResponse(item);
  }

  async remove(ownerId: string, vehicleId: string, id: string): Promise<void> {
    await this.assertOwnedVehicle(ownerId, vehicleId);
    try {
      await this.wishlistRepository.delete(vehicleId, id);
    } catch (error) {
      this.throwIfNotFound(error);
      throw error;
    }
  }

  // Another user's vehicle is a 404, not a 403, so its existence is not revealed.
  private async assertOwnedVehicle(ownerId: string, vehicleId: string): Promise<void> {
    const vehicle = await this.vehiclesRepository.findOwnedById(vehicleId, ownerId);
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }
  }

  // The vehicle can be deleted between the ownership check and the insert; Prisma reports the
  // broken foreign key as P2003, which must reach the client as a 404.
  private throwIfVehicleGone(error: unknown): void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003') {
      throw new NotFoundException('Vehículo no encontrado');
    }
  }

  // Deletes are scoped by `{ id, vehicleId }`; Prisma reports a missing row (another vehicle's
  // item, or one deleted concurrently) as P2025, which must reach the client as a 404.
  private throwIfNotFound(error: unknown): void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      throw new NotFoundException('Deseo no encontrado');
    }
  }
}
