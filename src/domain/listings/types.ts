/**
 * Listings: a sale or rent offering of a property, with its price in EUR (spec: properties, rule 4).
 */

export type OfferType = 'sale' | 'rent';

/** `active` and `reserved` are open; `closed` and `withdrawn` are final and read-only (L11). */
export type ListingStatus = 'active' | 'reserved' | 'closed' | 'withdrawn';

export type Listing = {
  id: string;
  agency_id: string;
  property_id: string;
  offer_type: OfferType;
  price: number;
  currency: 'EUR';
  status: ListingStatus;
  listed_at: string;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
