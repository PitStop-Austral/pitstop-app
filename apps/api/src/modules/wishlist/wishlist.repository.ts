import { Injectable } from '@nestjs/common';
import { Prisma, WishlistPriority } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const wishlistItemSelect = {
  id: true,
  vehicleId: true,
  name: true,
  estimatedPrice: true,
  priority: true,
  note: true,
  purchased: true,
  purchasedAt: true,
  createdAt: true,
} satisfies Prisma.WishlistItemSelect;

export type WishlistItemView = Prisma.WishlistItemGetPayload<{
  select: typeof wishlistItemSelect;
}>;

export type CreateWishlistItemData = {
  name: string;
  estimatedPrice: number | null;
  priority: WishlistPriority;
  note: string | null;
};

@Injectable()
export class WishlistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByVehicle(vehicleId: string): Promise<WishlistItemView[]> {
    return this.prisma.wishlistItem.findMany({
      where: { vehicleId },
      // The enum is declared ALTA, MEDIA, BAJA, so ascending priority is high to low.
      orderBy: [{ purchased: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      select: wishlistItemSelect,
    });
  }

  async findByVehicle(vehicleId: string, id: string): Promise<WishlistItemView | null> {
    return this.prisma.wishlistItem.findFirst({
      where: { id, vehicleId },
      select: wishlistItemSelect,
    });
  }

  async create(vehicleId: string, data: CreateWishlistItemData): Promise<WishlistItemView> {
    return this.prisma.wishlistItem.create({
      data: { ...data, vehicleId },
      select: wishlistItemSelect,
    });
  }

  // Only flips an item that is in the opposite state, so concurrent or repeated requests keep the
  // first purchase date. Matches no row when the item already has that state or does not exist.
  async setPurchased(
    vehicleId: string,
    id: string,
    purchased: boolean,
    purchasedAt: Date | null,
  ): Promise<void> {
    await this.prisma.wishlistItem.updateMany({
      where: { id, vehicleId, purchased: !purchased },
      data: { purchased, purchasedAt },
    });
  }

  async delete(vehicleId: string, id: string): Promise<void> {
    await this.prisma.wishlistItem.delete({ where: { id, vehicleId } });
  }
}
