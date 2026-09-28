import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateScheduleDto } from './create-schedule.dto';

describe('CreateScheduleDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata = { type: 'body' as const, metatype: CreateScheduleDto };

  it.each([
    { type: 'Filtros', intervalMonths: 6 },
    { type: 'Filtros', intervalKm: 10000 },
    { type: 'Revisión de dirección', intervalMonths: 6, intervalKm: 10000 },
  ])('accepts a valid schedule', async (value) => {
    await expect(pipe.transform(value, metadata)).resolves.toMatchObject(value);
  });

  it.each([
    { type: ' ' },
    { type: 'a'.repeat(61) },
    { type: 'Filtros', intervalMonths: 0 },
    { type: 'Filtros', intervalMonths: -1 },
    { type: 'Filtros', intervalMonths: 1.5 },
    { type: 'Filtros', intervalKm: 0 },
    { type: 'Filtros', intervalKm: -1 },
    { type: 'Filtros', intervalKm: 1.5 },
  ])('rejects invalid field values: %j', async (value) => {
    await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
  });
});
