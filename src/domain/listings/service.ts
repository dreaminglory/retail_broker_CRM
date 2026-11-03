import type { SupabaseClient } from '@supabase/supabase-js';
import { ListingRepository } from './repository';
import type { Listing } from './types';
import {
  createListingSchema,
  setListingStatusSchema,
  updateListingPriceSchema,
  type CreateListingInput,
  type SetListingStatusInput,
  type UpdateListingPriceInput,
} from './validation';

/**
 * Listings follow §3.6. The database holds the rules: one open listing per offer type (L5),
 * closed and withdrawn are read-only and get `closed_at` (L11), no new listing on an archived
 * property (L12). Every price and status change is audited by trigger (A1).
 */
export class ListingService {
  private readonly repo: ListingRepository;

  constructor(db: SupabaseClient) {
    this.repo = new ListingRepository(db);
  }

  async listForProperty(propertyId: string, agencyId: string): Promise<Listing[]> {
    return this.repo.findByProperty(propertyId, agencyId);
  }

  async create(agencyId: string, userId: string, input: CreateListingInput): Promise<Listing> {
    return this.repo.create(agencyId, userId, createListingSchema.parse(input));
  }

  async changePrice(id: string, agencyId: string, input: UpdateListingPriceInput): Promise<Listing> {
    return this.repo.update(id, agencyId, updateListingPriceSchema.parse(input));
  }

  async setStatus(id: string, agencyId: string, input: SetListingStatusInput): Promise<Listing> {
    return this.repo.update(id, agencyId, setListingStatusSchema.parse(input));
  }
}
