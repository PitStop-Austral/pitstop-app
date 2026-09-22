import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { SetVehiclePhotoDto } from './set-vehicle-photo.dto';

describe('SetVehiclePhotoDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: SetVehiclePhotoDto };
  const validPhoto = {
    photoPath: 'firebase-user-1/vehicles/7f2bd3b4-c22a-4e26-a4ea-0cb0d8102bb5/photo.webp',
    photoUrl: 'https://firebasestorage.googleapis.com/v0/b/pitstop/o/photo.webp',
  };

  it('accepts a valid Storage photo reference', async () => {
    await expect(pipe.transform(validPhoto, metadata)).resolves.toEqual(validPhoto);
  });

  it.each([
    ['an empty path', { photoPath: '' }],
    ['an invalid URL', { photoUrl: 'not-a-url' }],
    ['a non-HTTPS URL', { photoUrl: 'http://firebasestorage.googleapis.com/photo.webp' }],
    ['an oversized path', { photoPath: 'a'.repeat(301) }],
    ['an oversized URL', { photoUrl: `https://example.com/${'a'.repeat(1981)}` }],
  ])('rejects %s', async (_, invalidPhoto) => {
    await expect(pipe.transform({ ...validPhoto, ...invalidPhoto }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
