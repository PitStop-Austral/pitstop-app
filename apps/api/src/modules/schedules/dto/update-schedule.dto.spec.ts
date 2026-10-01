import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateScheduleDto } from './update-schedule.dto';

describe('UpdateScheduleDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata = { type: 'body' as const, metatype: UpdateScheduleDto };

  it.each([
    {},
    { type: ' Filtros ' },
    { intervalMonths: null, intervalKm: 10000 },
    { intervalMonths: 6, intervalKm: null },
  ])('accepts a valid partial update: %j', async (value) => {
    await expect(pipe.transform(value, metadata)).resolves.toBeInstanceOf(UpdateScheduleDto);
  });

  it.each([
    { type: null },
    { type: ' ' },
    { intervalMonths: 0 },
    { intervalMonths: 241 },
    { intervalKm: -1 },
    { intervalKm: 1.5 },
  ])('rejects invalid field values: %j', async (value) => {
    await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
  });
});
