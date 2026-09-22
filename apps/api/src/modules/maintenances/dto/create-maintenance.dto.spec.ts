import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateMaintenanceDto } from './create-maintenance.dto';

describe('CreateMaintenanceDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: CreateMaintenanceDto };

  it('accepts valid values and normalizes optional text', async () => {
    await expect(
      pipe.transform(
        {
          type: ' Cambio de aceite ',
          category: ' MANTENIMIENTO ',
          date: ' 2026-09-17 ',
          mileage: 48250,
          workshop: ' Lubricentro ',
          cost: 42000.5,
          notes: ' ',
        },
        metadata,
      ),
    ).resolves.toEqual({
      type: 'Cambio de aceite',
      category: 'MANTENIMIENTO',
      date: '2026-09-17',
      mileage: 48250,
      workshop: 'Lubricentro',
      cost: 42000.5,
      notes: null,
    });
  });

  const validMaintenance = {
    type: 'Cambio de aceite',
    category: 'MANTENIMIENTO',
    date: '2026-09-17',
    mileage: 48250,
  };

  it.each([
    ['an empty type', { type: '   ' }],
    ['a type longer than 60 characters', { type: 'a'.repeat(61) }],
    ['an invalid category', { category: 'PREVENTIVO' }],
    ['a non-ISO date', { date: '17/09/2026' }],
    ['an impossible calendar date', { date: '2026-02-30' }],
    ['negative mileage', { mileage: -1 }],
    ['fractional mileage', { mileage: 48250.5 }],
    ['mileage outside the database range', { mileage: 2_147_483_648 }],
    ['a cost with excessive precision', { cost: 42.123 }],
    ['a negative cost', { cost: -1 }],
    ['a cost outside the database range', { cost: 10_000_000_000 }],
    ['a workshop longer than 80 characters', { workshop: 'a'.repeat(81) }],
    ['notes longer than 500 characters', { notes: 'a'.repeat(501) }],
  ])('rejects %s', async (_, invalidFields) => {
    await expect(
      pipe.transform({ ...validMaintenance, ...invalidFields }, metadata),
    ).rejects.toThrow(BadRequestException);
  });
});
