import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import { propertyWriteFailure } from '@/domain/properties/repository';
import type { Listing, ListingStatus, OfferType } from './types';

/** The open-listing index (L5) as its own message; trigger keys and the rest as for properties. */
function listingWriteFailure(error: { code?: string; message: string }): DomainError {
  if (error.code === '23505' && error.message.includes('uq_listings_open_per_offer_type')) {
    return new DomainError('listings.errors.openExists');
  }
  return propertyWriteFailure(error);
}

export class ListingRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** A property's listings, newest first. */
  async findByProperty(propertyId: string, agencyId: string): Promise<Listing[]> {
    const { data, error } = await this.db
      .from('listings')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('property_id', propertyId)
      .order('listed_at', { ascending: false });

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch listings: ${error.message}`);
    return (data ?? []) as Listing[];
  }

  async create(
    agencyId: string,
    userId: string,
    input: { property_id: string; offer_type: OfferType; price: number },
  ): Promise<Listing> {
    const { data, error } = await this.db
      .from('listings')
      .insert({ ...input, agency_id: agencyId, created_by: userId })
      .select()
      .single();

    if (error) throw listingWriteFailure(error);
    return data as Listing;
  }

  async update(
    id: string,
    agencyId: string,
    changes: { price?: number; status?: ListingStatus },
  ): Promise<Listing> {
    const { data, error } = await this.db
      .from('listings')
      .update(changes)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .maybeSingle();

    if (error) throw listingWriteFailure(error);
    if (!data) throw new DomainError('errors.not_found');
    return data as Listing;
  }
}
