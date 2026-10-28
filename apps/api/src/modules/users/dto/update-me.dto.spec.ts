import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeDto } from './update-me.dto';

describe('UpdateMeDto', () => {
  it('trims a valid name', async () => {
    const dto = plainToInstance(UpdateMeDto, { name: '  Ada Lovelace  ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('Ada Lovelace');
  });

  it.each(['', '   ', 'a'.repeat(61)])('rejects an invalid name', async (name) => {
    const dto = plainToInstance(UpdateMeDto, { name });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('name');
  });
});
