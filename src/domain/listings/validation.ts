import { z } from 'zod';
import type { Property } from '@/domain/properties/types';
import type { ListingStatus, OfferType } from './types';

export const OFFER_TYPES = ['sale', 'rent'] as const satisfies readonly OfferType[];
export const LISTING_STATUSES = ['active', 'reserved', 'closed', 'withdrawn'] as const satisfies readonly ListingStatus[];
export const OPEN_LISTING_STATUSES: readonly ListingStatus[] = ['active', 'reserved'];

export function isOpenListing(status: ListingStatus): boolean {
  return OPEN_LISTING_STATUSES.includes(status);
}

/** What an open listing can move to (§3.6); a closed or withdrawn one is read-only. */
export function listingStatusChanges(status: ListingStatus): ListingStatus[] {
  if (!isOpenListing(status)) return [];
  return [status === 'active' ? 'reserved' : 'active', 'closed', 'withdrawn'];
}

/** Shown on screen only, never stored (spec open question). A plot is priced by its plot area. */
export function pricePerSquareMeter(
  price: number,
  property: Pick<Property, 'type' | 'area_m2' | 'plot_m2'>,
): number | null {
  const area = property.type === 'plot' ? property.plot_m2 : property.area_m2;
  return area ? price / Number(area) : null;
}

/** "185 000", "185000", "650,50": spaces are thousand separators, a comma is the decimal mark. */
const price = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const text = value.replace(/[\s  ]/g, '').replace(',', '.');
    return text === '' ? undefined : Number(text);
  },
  z
    .number({ required_error: 'validation.price_required', invalid_type_error: 'validation.price_required' })
    .positive('validation.price_positive')
    .max(999_999_999_999, 'validation.number_too_large')
    .multipleOf(0.01, 'validation.price_cents'),
);

export const createListingSchema = z.object({
  property_id: z.string().uuid(),
  offer_type: z.enum(OFFER_TYPES, { errorMap: () => ({ message: 'validation.offer_type_required' }) }),
  price,
});

export const updateListingPriceSchema = z.object({ price });

export const setListingStatusSchema = z.object({ status: z.enum(LISTING_STATUSES) });

export type CreateListingInput = z.input<typeof createListingSchema>;
export type UpdateListingPriceInput = z.input<typeof updateListingPriceSchema>;
export type SetListingStatusInput = z.input<typeof setListingStatusSchema>;
