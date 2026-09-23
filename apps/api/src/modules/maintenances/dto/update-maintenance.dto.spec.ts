import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateMaintenanceDto } from './update-maintenance.dto';

describe('UpdateMaintenanceDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: UpdateMaintenanceDto };

  it('accepts an empty body', async () => {
    await expect(pipe.transform({}, metadata)).resolves.toBeInstanceOf(UpdateMaintenanceDto);
  });

  it('turns empty optional text into null so it can be cleared', async () => {
    await expect(pipe.transform({ notes: ' ', cost: null }, metadata)).resolves.toMatchObject({
      notes: null,
      cost: null,
    });
  });

  it.each([
    ['an invalid category', { category: 'PREVENTIVO' }],
    ['a null type', { type: null }],
    ['a null mileage', { mileage: null }],
    ['a null date', { date: null }],
    ['an empty type', { type: '  ' }],
  ])('rejects %s', async (_, body) => {
    await expect(pipe.transform(body, metadata)).rejects.toThrow(BadRequestException);
  });
});
