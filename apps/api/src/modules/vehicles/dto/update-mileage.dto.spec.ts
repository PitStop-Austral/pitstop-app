import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateMileageDto } from './update-mileage.dto';

describe('UpdateMileageDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: UpdateMileageDto };

  it('accepts a non-negative integer mileage', async () => {
    await expect(pipe.transform({ mileage: 48250 }, metadata)).resolves.toEqual({ mileage: 48250 });
  });

  it.each([-1, 2_147_483_648, 48.5, '48250'])('rejects invalid mileage %p', async (mileage) => {
    await expect(pipe.transform({ mileage }, metadata)).rejects.toThrow(BadRequestException);
  });
});
