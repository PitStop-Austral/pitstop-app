import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdatePreferencesDto } from './update-preferences.dto';

describe('UpdatePreferencesDto', () => {
  it('accepts zero for both thresholds', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {
      upcomingThresholdDays: 0,
      upcomingThresholdKm: 0,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    { upcomingThresholdDays: undefined, upcomingThresholdKm: 1500 },
    { upcomingThresholdDays: -1, upcomingThresholdKm: 1500 },
    { upcomingThresholdDays: 30.5, upcomingThresholdKm: 1500 },
    { upcomingThresholdDays: '30', upcomingThresholdKm: 1500 },
    { upcomingThresholdDays: null, upcomingThresholdKm: 1500 },
    { upcomingThresholdDays: 3651, upcomingThresholdKm: 1500 },
    { upcomingThresholdDays: 30, upcomingThresholdKm: 500001 },
  ])('rejects invalid thresholds: %j', async (input) => {
    const dto = plainToInstance(UpdatePreferencesDto, input);

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
