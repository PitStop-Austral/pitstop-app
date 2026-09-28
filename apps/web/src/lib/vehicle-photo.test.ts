import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePhotoFile } from './vehicle-photo-validation.ts';

test('vehicle photo validation accepts images up to 10 MB', () => {
  const file = new File([new Uint8Array(10 * 1024 * 1024)], 'vehicle.jpg', {
    type: 'image/jpeg',
  });

  assert.equal(validatePhotoFile(file), null);
});

test('vehicle photo validation rejects non-images and oversize files', () => {
  const pdf = new File(['document'], 'vehicle.pdf', { type: 'application/pdf' });
  const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'vehicle.jpg', {
    type: 'image/jpeg',
  });

  assert.equal(validatePhotoFile(pdf), 'Elegí una imagen (JPG, PNG o WebP)');
  assert.equal(validatePhotoFile(oversized), 'La foto pesa más de 10 MB. Probá con otra.');
});
