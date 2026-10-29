import { validate } from 'class-validator';
import { UpdateNotificationPreferencesDto } from './update-notification-preferences.dto';

describe('UpdateNotificationPreferencesDto', () => {
  it.each([true, false])('accepts the boolean value %s', async (enabled) => {
    const dto = Object.assign(new UpdateNotificationPreferencesDto(), { enabled });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['true', 1, null, undefined])('rejects the non-boolean value %p', async (enabled) => {
    const dto = Object.assign(new UpdateNotificationPreferencesDto(), { enabled });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('enabled');
  });
});
