import { describe, expect, it } from 'vitest';
import { createListingSchema, listingStatusChanges, pricePerSquareMeter, updateListingPriceSchema } from './validation';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';

describe('createListingSchema', () => {
  it('accepts a sale listing with a price typed in a form', () => {
    expect(createListingSchema.parse({ property_id: PROPERTY_ID, offer_type: 'sale', price: '185 000' })).toEqual({
      property_id: PROPERTY_ID,
      offer_type: 'sale',
      price: 185000,
    });
  });

  it('reads a decimal comma', () => {
    expect(updateListingPriceSchema.parse({ price: '650,50' })).toEqual({ price: 650.5 });
  });

  it('refuses a price of zero or less, and a missing one (rule 4)', () => {
    expect(updateListingPriceSchema.safeParse({ price: '0' }).error?.issues[0].message).toBe('validation.price_positive');
    expect(updateListingPriceSchema.safeParse({ price: '-5' }).success).toBe(false);
    expect(updateListingPriceSchema.safeParse({ price: '' }).error?.issues[0].message).toBe('validation.price_required');
  });

  it('refuses an unknown offer type', () => {
    expect(createListingSchema.safeParse({ property_id: PROPERTY_ID, offer_type: 'lease', price: '100' }).success).toBe(false);
  });
});

describe('listingStatusChanges', () => {
  it('lets an open listing be reserved, reopened, closed or withdrawn', () => {
    expect(listingStatusChanges('active')).toEqual(['reserved', 'closed', 'withdrawn']);
    expect(listingStatusChanges('reserved')).toEqual(['active', 'closed', 'withdrawn']);
  });

  it('offers nothing on a closed or withdrawn listing (read-only)', () => {
    expect(listingStatusChanges('closed')).toEqual([]);
    expect(listingStatusChanges('withdrawn')).toEqual([]);
  });
});

describe('pricePerSquareMeter', () => {
  it('divides by the built-up area, or by the plot area for a plot', () => {
    expect(pricePerSquareMeter(185000, { type: 'apartment', area_m2: 68, plot_m2: null })).toBeCloseTo(2720.59, 2);
    expect(pricePerSquareMeter(60000, { type: 'plot', area_m2: null, plot_m2: 600 })).toBe(100);
  });

  it('is null without an area', () => {
    expect(pricePerSquareMeter(185000, { type: 'garage', area_m2: null, plot_m2: null })).toBeNull();
  });
});
