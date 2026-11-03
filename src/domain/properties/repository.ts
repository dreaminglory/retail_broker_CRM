import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import { OPEN_LISTING_STATUSES } from '@/domain/listings/validation';
import { hasListingFilter, type PropertyListFilters } from './list-filters';
import type { Property, PropertyWithOpenListings } from './types';
import type { PropertyFormValues } from './validation';

/**
 * A failed property write as a DomainError: the i18n keys the property triggers raise (AD-032),
 * the area-in-settlement foreign key (L4), else `errors.saveFailed`.
 */
export function propertyWriteFailure(error: { code?: string; message: string }): DomainError {
  if (error.code === 'P0001' && /^[a-z]+\.errors\.\w+$/.test(error.message)) return new DomainError(error.message);
  if (error.code === '23503' && error.message.includes('fk_properties_area')) {
    return new DomainError('properties.errors.areaNotInSettlement');
  }
  return new DomainError('errors.saveFailed', `Failed to save property: ${error.message}`);
}

export class PropertyRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string, agencyId: string): Promise<Property | null> {
    const { data, error } = await this.db
      .from('properties')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch property: ${error.message}`);
    return data as Property | null;
  }

  /**
   * One page of the list, newest first, with each property's open listings. A listing filter
   * joins a second, `!inner` copy of listings, so a property shows once however many of its
   * listings match, and one without a match drops out.
   */
  async findPage(
    agencyId: string,
    filters: PropertyListFilters,
    { limit, offset }: { limit: number; offset: number },
  ): Promise<{ rows: PropertyWithOpenListings[]; total: number }> {
    const listingFilter = hasListingFilter(filters);
    const select = [
      '*',
      'open_listings:listings!fk_listings_property(id, offer_type, price, status)',
      ...(listingFilter ? ['matching:listings!fk_listings_property!inner(id)'] : []),
    ].join(', ');

    let query = this.db
      .from('properties')
      .select(select, { count: 'exact' })
      .eq('agency_id', agencyId)
      .in('open_listings.status', OPEN_LISTING_STATUSES);

    if (filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.settlementId) query = query.eq('settlement_id', filters.settlementId);
    if (filters.areaId) query = query.eq('area_id', filters.areaId);
    if (filters.rooms) query = query.eq('rooms', filters.rooms);
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

    if (listingFilter) {
      // Price and offer type match open listings unless a listing status is chosen.
      query = query.in('matching.status', filters.listingStatus ? [filters.listingStatus] : OPEN_LISTING_STATUSES);
      if (filters.offerType) query = query.eq('matching.offer_type', filters.offerType);
      if (filters.priceMin !== undefined) query = query.gte('matching.price', filters.priceMin);
      if (filters.priceMax !== undefined) query = query.lte('matching.price', filters.priceMax);
    }

    const { data, error, count } = await query
      .order('code', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch properties: ${error.message}`);
    // The `matching` copy only filters; it isn't sent on to the page.
    const rows = ((data ?? []) as unknown as (PropertyWithOpenListings & { matching?: unknown })[]).map((row) => {
      delete row.matching;
      return row as PropertyWithOpenListings;
    });
    return { rows, total: count ?? 0 };
  }

  async create(
    agencyId: string,
    userId: string,
    input: PropertyFormValues & { assigned_to: string },
  ): Promise<Property> {
    const { data, error } = await this.db
      .from('properties')
      .insert({ ...input, agency_id: agencyId, created_by: userId })
      .select()
      .single();

    if (error) throw propertyWriteFailure(error);
    return data as Property;
  }
}
