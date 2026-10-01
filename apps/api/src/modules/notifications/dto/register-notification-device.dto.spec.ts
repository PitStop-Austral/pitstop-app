import { validate } from 'class-validator';
import { RegisterNotificationDeviceDto } from './register-notification-device.dto';

describe('RegisterNotificationDeviceDto', () => {
  it('accepts a UUID installation and a non-empty token', async () => {
    const dto = Object.assign(new RegisterNotificationDeviceDto(), {
      installationId: '11111111-1111-4111-8111-111111111111',
      token: 'fcm-token',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    [{ installationId: 'not-a-uuid', token: 'fcm-token' }, 'installationId'],
    [{ installationId: '11111111-1111-4111-8111-111111111111', token: '' }, 'token'],
    [
      {
        installationId: '11111111-1111-4111-8111-111111111111',
        token: 'x'.repeat(4097),
      },
      'token',
    ],
  ])('rejects invalid notification device input %#', async (input, property) => {
    const dto = Object.assign(new RegisterNotificationDeviceDto(), input);
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(property);
  });
});
