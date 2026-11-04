import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { Property } from '@/domain/properties/types';
import type { PartyRole, PropertyParty, PropertyPartyWithContact } from './types';

export type PartyWithProperty = PropertyParty & {
  property: Pick<Property, 'id' | 'code' | 'type' | 'rooms' | 'status' | 'settlement_id' | 'area_id'>;
};

export class PropertyPartyRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByProperty(propertyId: string, agencyId: string): Promise<PropertyPartyWithContact[]> {
    const { data, error } = await this.db
      .from('property_parties')
      .select('*, contact:contacts!fk_property_parties_contact(id, display_name, status)')
      .eq('agency_id', agencyId)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true });

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch property parties: ${error.message}`);
    return (data ?? []) as PropertyPartyWithContact[];
  }

  async findByContact(contactId: string, agencyId: string): Promise<PartyWithProperty[]> {
    const { data, error } = await this.db
      .from('property_parties')
      .select('*, property:properties!fk_property_parties_property(id, code, type, rooms, status, settlement_id, area_id)')
      .eq('agency_id', agencyId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch contact properties: ${error.message}`);
    return (data ?? []) as PartyWithProperty[];
  }

  async create(
    agencyId: string,
    userId: string,
    input: { property_id: string; contact_id: string; role: PartyRole },
  ): Promise<PropertyParty> {
    const { data, error } = await this.db
      .from('property_parties')
      .insert({ ...input, agency_id: agencyId, created_by: userId })
      .select()
      .single();

    if (error) {
      // L6: one open row per property and contact.
      if (error.code === '23505' && error.message.includes('uq_property_parties_open')) {
        throw new DomainError('propertyParties.errors.alreadyParty');
      }
      throw new DomainError('errors.saveFailed', `Failed to add property party: ${error.message}`);
    }
    return data as PropertyParty;
  }

  /** Ends a current party; null when it was already ended or isn't the agency's. */
  async end(id: string, agencyId: string): Promise<PropertyParty | null> {
    const { data, error } = await this.db
      .from('property_parties')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .is('ended_at', null)
      .select()
      .maybeSingle();

    if (error) throw new DomainError('errors.saveFailed', `Failed to end property party: ${error.message}`);
    return data as PropertyParty | null;
  }
}
