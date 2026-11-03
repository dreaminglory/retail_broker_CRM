import { describe, expect, it } from 'vitest';
import { hasListingFilter, parsePropertyListFilters } from './list-filters';

const ID = '11111111-1111-4111-8111-111111111111';

describe('parsePropertyListFilters', () => {
  it('shows active properties with no other filter by default', () => {
    expect(parsePropertyListFilters({})).toEqual({ status: 'active' });
  });

  it('reads every filter from the URL', () => {
    expect(
      parsePropertyListFilters({
        type: 'apartment',
        settlement: ID,
        area: ID,
        offer: 'sale',
        listing: 'reserved',
        min: '150000',
        max: '200 000',
        rooms: '2',
        broker: ID,
        status: 'all',
      }),
    ).toEqual({
      type: 'apartment',
      settlementId: ID,
      areaId: ID,
      offerType: 'sale',
      listingStatus: 'reserved',
      priceMin: 150000,
      priceMax: 200000,
      rooms: 2,
      assignedTo: ID,
      status: 'all',
    });
  });

  it('ignores values that are not valid instead of failing the page', () => {
    expect(
      parsePropertyListFilters({ type: 'castle', settlement: 'x', min: '-5', max: 'abc', rooms: '12', status: 'gone', offer: 'lease' }),
    ).toEqual({ status: 'active' });
  });

  it('takes the first value of a repeated parameter', () => {
    expect(parsePropertyListFilters({ type: ['plot', 'garage'] })).toMatchObject({ type: 'plot' });
  });
});

describe('hasListingFilter', () => {
  it('is true only for offer type, listing status or price', () => {
    expect(hasListingFilter({ status: 'active', type: 'apartment', rooms: 2 })).toBe(false);
    expect(hasListingFilter({ status: 'active', offerType: 'rent' })).toBe(true);
    expect(hasListingFilter({ status: 'active', listingStatus: 'closed' })).toBe(true);
    expect(hasListingFilter({ status: 'active', priceMax: 200000 })).toBe(true);
  });
});
