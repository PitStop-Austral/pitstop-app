import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateWishlistItemDto } from './create-wishlist-item.dto';
import { UpdateWishlistPurchasedDto } from './update-wishlist-purchased.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true });

async function validationMessages(metatype: new () => object, body: unknown): Promise<string[]> {
  try {
    await pipe.transform(body, { type: 'body', metatype });
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const { message } = (error as BadRequestException).getResponse() as { message: string[] };
    return message;
  }
  throw new Error('Expected the body to be rejected');
}

describe('CreateWishlistItemDto', () => {
  const metadata = { type: 'body' as const, metatype: CreateWishlistItemDto };

  it('accepts valid values and normalizes text', async () => {
    await expect(
      pipe.transform(
        { name: ' Llantas 17" ', estimatedPrice: 480000.5, priority: 'BAJA', note: ' ' },
        metadata,
      ),
    ).resolves.toEqual({
      name: 'Llantas 17"',
      estimatedPrice: 480000.5,
      priority: 'BAJA',
      note: null,
    });
  });

  it('accepts only a name', async () => {
    await expect(pipe.transform({ name: 'Cubre asientos' }, metadata)).resolves.toEqual({
      name: 'Cubre asientos',
    });
  });

  it.each([0, 0.1, 0.29, 450000.5, 9_999_999_999.99])('accepts a price of %p', async (price) => {
    await expect(
      pipe.transform({ name: 'Llantas', estimatedPrice: price }, metadata),
    ).resolves.toEqual({ name: 'Llantas', estimatedPrice: price });
  });

  it('accepts a null price', async () => {
    await expect(
      pipe.transform({ name: 'Llantas', estimatedPrice: null }, metadata),
    ).resolves.toEqual({ name: 'Llantas', estimatedPrice: null });
  });

  const nameMessage = 'Ingresá el nombre del deseo';
  const priceMessage = 'El precio tiene que ser un número mayor o igual a 0';

  it.each([
    ['a missing name', {}, nameMessage],
    ['a blank name', { name: '   ' }, nameMessage],
    ['a non-string name', { name: 123 }, nameMessage],
    [
      'a name longer than 80 characters',
      { name: 'a'.repeat(81) },
      'El nombre puede tener hasta 80 caracteres',
    ],
    ['a negative price', { name: 'Llantas', estimatedPrice: -1 }, priceMessage],
    ['a price with 3 decimals', { name: 'Llantas', estimatedPrice: 1.234 }, priceMessage],
    ['a price in exponent notation', { name: 'Llantas', estimatedPrice: 1e-7 }, priceMessage],
    ['a NaN price', { name: 'Llantas', estimatedPrice: NaN }, priceMessage],
    ['an infinite price', { name: 'Llantas', estimatedPrice: Infinity }, priceMessage],
    [
      'a price outside the database range',
      { name: 'Llantas', estimatedPrice: 10_000_000_000 },
      priceMessage,
    ],
    ['a non-numeric price', { name: 'Llantas', estimatedPrice: '100' }, priceMessage],
    [
      'an invalid priority',
      { name: 'Llantas', priority: 'URGENTE' },
      'La prioridad tiene que ser alta, media o baja',
    ],
    ['a non-string note', { name: 'Llantas', note: 5 }, 'La nota tiene que ser un texto'],
    [
      'a note longer than 280 characters',
      { name: 'Llantas', note: 'a'.repeat(281) },
      'La nota puede tener hasta 280 caracteres',
    ],
  ])('rejects %s', async (_, body, expected) => {
    const messages = await validationMessages(CreateWishlistItemDto, body);
    expect(messages).toEqual([expected]);
  });
});

describe('UpdateWishlistPurchasedDto', () => {
  it('accepts a boolean', async () => {
    await expect(
      pipe.transform({ purchased: false }, { type: 'body', metatype: UpdateWishlistPurchasedDto }),
    ).resolves.toEqual({ purchased: false });
  });

  it.each([
    ['a missing value', {}],
    ['a string', { purchased: 'true' }],
    ['a number', { purchased: 1 }],
  ])('rejects %s', async (_, body) => {
    const messages = await validationMessages(UpdateWishlistPurchasedDto, body);
    expect(messages).toEqual(['Indicá si el deseo está comprado']);
  });
});
