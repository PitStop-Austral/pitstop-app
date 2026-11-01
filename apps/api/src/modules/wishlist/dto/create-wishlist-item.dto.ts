import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, ValidateBy } from 'class-validator';
import { WishlistPriority } from '../../../generated/prisma/client';
import { normalizeOptionalText, trim } from '../../maintenances/dto/create-maintenance.dto';

export const MAX_WISHLIST_PRICE = 9_999_999_999.99;

const NAME_MESSAGE = 'Ingresá el nombre del deseo';
const PRICE_MESSAGE = 'El precio tiene que ser un número mayor o igual a 0';

// One validator per field so each invalid field yields exactly one message.
function IsWishlistName(): PropertyDecorator {
  return ValidateBy({
    name: 'isWishlistName',
    validator: {
      validate: (value) => typeof value === 'string' && value.length > 0 && value.length <= 80,
      defaultMessage: (args) =>
        typeof args?.value === 'string' && args.value.length > 80
          ? 'El nombre puede tener hasta 80 caracteres'
          : NAME_MESSAGE,
    },
  });
}

// Counts decimals arithmetically: class-validator's maxDecimalPlaces splits `toString()` on '.',
// which throws for exponent notation such as 1e-7. The tolerance absorbs float error (0.29 * 100).
function hasAtMostTwoDecimals(value: number): boolean {
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) <= Number.EPSILON * 4 * Math.max(1, cents);
}

function IsWishlistPrice(): PropertyDecorator {
  return ValidateBy({
    name: 'isWishlistPrice',
    validator: {
      validate: (value) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= MAX_WISHLIST_PRICE &&
        hasAtMostTwoDecimals(value),
      defaultMessage: () => PRICE_MESSAGE,
    },
  });
}

function IsWishlistNote(): PropertyDecorator {
  return ValidateBy({
    name: 'isWishlistNote',
    validator: {
      validate: (value) => typeof value === 'string' && value.length <= 280,
      defaultMessage: (args) =>
        typeof args?.value === 'string'
          ? 'La nota puede tener hasta 280 caracteres'
          : 'La nota tiene que ser un texto',
    },
  });
}

export class CreateWishlistItemDto {
  @Transform(({ value }) => trim(value))
  @IsWishlistName()
  name: string;

  @IsOptional()
  @IsWishlistPrice()
  estimatedPrice?: number | null;

  @IsOptional()
  @IsEnum(WishlistPriority, { message: 'La prioridad tiene que ser alta, media o baja' })
  priority?: WishlistPriority;

  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsWishlistNote()
  note?: string | null;
}
