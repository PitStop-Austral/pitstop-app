import { IsBoolean } from 'class-validator';

export class UpdateWishlistPurchasedDto {
  @IsBoolean({ message: 'Indicá si el deseo está comprado' })
  purchased: boolean;
}
