import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { FuelType } from '../../../generated/prisma/client';
import { CreateVehicleDto } from './create-vehicle.dto';

describe('CreateVehicleDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: CreateVehicleDto };
  const validVehicle = {
    brand: 'Honda',
    model: 'Civic',
    year: 2021,
    fuel: FuelType.NAFTA,
    plate: 'AF812KM',
    mileage: 48000,
  };

  it('normalizes a lowercase plate with display spacing', async () => {
    const result = await pipe.transform({ ...validVehicle, plate: 'af 812 km' }, metadata);

    expect(result.plate).toBe('AF812KM');
  });

  it.each([
    ['an impossible year', { year: 1899 }],
    ['an invalid plate', { plate: 'ABC-123' }],
    ['a negative mileage', { mileage: -1 }],
    ['mileage above the database range', { mileage: 2_147_483_648 }],
    ['an empty brand', { brand: '  ' }],
    ['an empty model', { model: '' }],
  ])('rejects %s', async (_, invalidFields) => {
    await expect(pipe.transform({ ...validVehicle, ...invalidFields }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
