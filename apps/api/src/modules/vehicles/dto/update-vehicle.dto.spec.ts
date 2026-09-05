import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateVehicleDto } from './update-vehicle.dto';

describe('UpdateVehicleDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: UpdateVehicleDto };

  it('allows omitted fields and an explicitly cleared nickname', async () => {
    await expect(pipe.transform({}, metadata)).resolves.toEqual({});
    await expect(pipe.transform({ nickname: null }, metadata)).resolves.toEqual({ nickname: null });
  });

  it.each(['brand', 'model', 'year', 'fuel', 'plate', 'mileage'])(
    'rejects null for the required %s field',
    async (field) => {
      await expect(pipe.transform({ [field]: null }, metadata)).rejects.toThrow(
        BadRequestException,
      );
    },
  );
});
