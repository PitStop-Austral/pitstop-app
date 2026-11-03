import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INITIAL_WISHLIST_FORM_VALUES,
  getWishlistFormErrors,
  wishlistFormSchema,
} from './wishlist-form-schema.ts';
import type { WishlistFormValues } from './wishlist-form-schema.ts';

const valid: WishlistFormValues = { ...INITIAL_WISHLIST_FORM_VALUES, name: 'Llantas' };

function errorsFor(values: WishlistFormValues) {
  const result = wishlistFormSchema.safeParse(values);
  assert.equal(result.success, false);
  return getWishlistFormErrors(result.error!);
}

test('rejects an empty name', () => {
  assert.deepEqual(errorsFor({ ...valid, name: '   ' }), { name: 'Ingresá el nombre del deseo' });
});

test('rejects a name longer than 80 characters', () => {
  assert.deepEqual(errorsFor({ ...valid, name: 'a'.repeat(81) }), {
    name: 'Usá hasta 80 caracteres',
  });
});

test('rejects a negative price and a price with 3 decimals', () => {
  const message = { estimatedPrice: 'Ingresá un precio válido, mayor o igual a cero' };
  assert.deepEqual(errorsFor({ ...valid, estimatedPrice: '-1' }), message);
  assert.deepEqual(errorsFor({ ...valid, estimatedPrice: '10.123' }), message);
});

test('accepts a comma as decimal separator', () => {
  const result = wishlistFormSchema.parse({ ...valid, estimatedPrice: '95000,50' });
  assert.equal(result.estimatedPrice, 95000.5);
});

test('rejects a note longer than 280 characters', () => {
  assert.deepEqual(errorsFor({ ...valid, note: 'a'.repeat(281) }), {
    note: 'Usá hasta 280 caracteres',
  });
});

test('leaves empty price and note out and defaults priority to MEDIA', () => {
  const result = wishlistFormSchema.parse({ name: ' Llantas ', estimatedPrice: ' ', note: '  ' });
  assert.deepEqual(result, { name: 'Llantas', priority: 'MEDIA' });
});
