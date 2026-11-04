import { z } from 'zod';
import { LISTING_STATUSES, OFFER_TYPES } from '@/domain/listings/validation';
import type { ListingStatus, OfferType } from '@/domain/listings/types';
import type { PropertyType } from './types';
import { PROPERTY_TYPES } from './validation';

/** The `/properties` filters, kept in the URL (spec: properties, Screens). */
export type PropertyListFilters = {
  status: 'active' | 'archived' | 'all';
  type?: PropertyType;
  settlementId?: string;
  areaId?: string;
  offerType?: OfferType;
  listingStatus?: ListingStatus;
  priceMin?: number;
  priceMax?: number;
  rooms?: number;
  assignedTo?: string;
};

type Param = string | string[] | undefined;

const uuid = z.string().uuid();
const price = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() ? Number(value.replace(/[\s ]/g, '')) : undefined),
  z.number().nonnegative(),
);

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pick<S extends z.ZodTypeAny>(schema: S, value: Param): z.output<S> | undefined {
  const parsed = schema.safeParse(first(value));
  return parsed.success ? parsed.data : undefined;
}

/** A filter that isn't valid is ignored, so a stale or edited link still shows a list. */
export function parsePropertyListFilters(params: Record<string, Param>): PropertyListFilters {
  const filters: PropertyListFilters = {
    status: pick(z.enum(['active', 'archived', 'all']), params.status) ?? 'active',
    type: pick(z.enum(PROPERTY_TYPES), params.type),
    settlementId: pick(uuid, params.settlement),
    areaId: pick(uuid, params.area),
    offerType: pick(z.enum(OFFER_TYPES), params.offer),
    listingStatus: pick(z.enum(LISTING_STATUSES), params.listing),
    priceMin: pick(price, params.min),
    priceMax: pick(price, params.max),
    rooms: pick(z.coerce.number().int().min(1).max(9), params.rooms),
    assignedTo: pick(uuid, params.broker),
  };
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined)) as PropertyListFilters;
}

/**
 * Offer type, listing status and price filter on listings: only properties with a matching
 * listing show. Without them, properties without listings show too.
 */
export function hasListingFilter(filters: PropertyListFilters): boolean {
  return (
    filters.offerType !== undefined ||
    filters.listingStatus !== undefined ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined
  );
}
