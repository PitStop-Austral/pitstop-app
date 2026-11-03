import { z } from 'zod';

import { WISHLIST_PRIORITIES } from './types.ts';
import type { WishlistItemInput } from './types.ts';

// Same cap as the API's MAX_WISHLIST_PRICE.
const MAX_WISHLIST_PRICE = 9_999_999_999.99;
const PRICE_MESSAGE = 'Ingresá un precio válido, mayor o igual a cero';

export const wishlistFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Ingresá el nombre del deseo')
      .max(80, 'Usá hasta 80 caracteres'),
    estimatedPrice: z
      .string()
      .trim()
      .transform((value) => value.replace(',', '.'))
      .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), PRICE_MESSAGE)
      .transform((value) => (value === '' ? undefined : Number(value)))
      .refine((value) => value === undefined || value <= MAX_WISHLIST_PRICE, PRICE_MESSAGE),
    priority: z.enum(WISHLIST_PRIORITIES).default('MEDIA'),
    note: z.string().trim().max(280, 'Usá hasta 280 caracteres'),
  })
  // Empty optional fields are left out of the body instead of being sent as undefined/''.
  .transform(({ name, estimatedPrice, priority, note }): WishlistItemInput => ({
    name,
    priority,
    ...(estimatedPrice === undefined ? {} : { estimatedPrice }),
    ...(note ? { note } : {}),
  }));

export type WishlistFormValues = z.input<typeof wishlistFormSchema>;
export type WishlistFormErrors = Partial<Record<keyof WishlistFormValues, string>>;

export const INITIAL_WISHLIST_FORM_VALUES = {
  name: '',
  estimatedPrice: '',
  priority: 'MEDIA',
  note: '',
} as const satisfies WishlistFormValues;

const FORM_FIELDS = ['name', 'estimatedPrice', 'priority', 'note'] as const;

export function getWishlistFormErrors(error: z.ZodError): WishlistFormErrors {
  const fieldErrors = z.flattenError(error).fieldErrors as Partial<
    Record<keyof WishlistFormValues, string[]>
  >;
  const errors: WishlistFormErrors = {};
  for (const field of FORM_FIELDS) {
    const message = fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }
  return errors;
}
