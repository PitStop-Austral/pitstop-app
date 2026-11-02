import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistPurchasedDto } from './dto/update-wishlist-purchased.dto';
import type { WishlistItemResponse } from './wishlist.mapper';
import { WishlistService } from './wishlist.service';

@Controller('vehicles/:vehicleId/wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<WishlistItemResponse[]> {
    return this.wishlistService.findByVehicle(user.id, vehicleId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateWishlistItemDto,
  ): Promise<WishlistItemResponse> {
    return this.wishlistService.create(user.id, vehicleId, dto);
  }

  @Patch(':id/purchased')
  setPurchased(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWishlistPurchasedDto,
  ): Promise<WishlistItemResponse> {
    return this.wishlistService.setPurchased(user.id, vehicleId, id, dto.purchased);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.wishlistService.remove(user.id, vehicleId, id);
  }
}
