import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { WishlistController } from './wishlist.controller';
import { WishlistRepository } from './wishlist.repository';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [VehiclesModule],
  controllers: [WishlistController],
  providers: [WishlistRepository, WishlistService],
})
export class WishlistModule {}
