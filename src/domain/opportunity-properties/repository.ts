import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { Property } from '@/domain/properties/types';
import type {
  OpportunityProperty,
  PropertyLinkRelation,
  PropertyLinkSource,
  PropertyLinkStatus,
  PropertyOpportunityLink,
} from './types';

export type LinkWithPropertyRow = OpportunityProperty & {
  property: Pick<Property, 'id' | 'code' | 'type' | 'rooms' | 'area_m2' | 'address' | 'status' | 'settlement_id' | 'area_id'>;
};

/**
 * A failed link write as a DomainError: the keys the link triggers raise (rules 5 and 8,
 * AD-032), the unique indexes, else `errors.saveFailed`.
 */
export function linkWriteFailure(error: { code?: string; message: string }): DomainError {
  if (error.code === 'P0001' && /^[a-z]+\.errors\.\w+$/i.test(error.message)) return new DomainError(error.message);
  if (error.code === '23505') {
    if (error.message.includes('uq_opportunity_properties_one_selected')) {
      return new DomainError('opportunityProperties.errors.alreadySelected');
    }
    if (error.message.includes('uq_opportunity_properties_one_subject')) {
      return new DomainError('opportunityProperties.errors.subjectExists');
    }
    if (error.message.includes('uq_opportunity_properties_pair')) {
      return new DomainError('opportunityProperties.errors.alreadyLinked');
    }
  }
  return new DomainError('errors.saveFailed', `Failed to save property link: ${error.message}`);
}

export class OpportunityPropertyRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByOpportunity(opportunityId: string, agencyId: string): Promise<LinkWithPropertyRow[]> {
    const { data, error } = await this.db
      .from('opportunity_properties')
      .select(
        '*, property:properties!fk_opportunity_properties_property(id, code, type, rooms, area_m2, address, status, settlement_id, area_id)',
      )
      .eq('agency_id', agencyId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch property links: ${error.message}`);
    return (data ?? []) as LinkWithPropertyRow[];
  }

  async findByProperty(propertyId: string, agencyId: string): Promise<PropertyOpportunityLink[]> {
    const { data, error } = await this.db
      .from('opportunity_properties')
      .select('*, opportunity:opportunities!fk_opportunity_properties_opportunity(id, title, type, status)')
      .eq('agency_id', agencyId)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch property opportunities: ${error.message}`);
    return (data ?? []) as PropertyOpportunityLink[];
  }

  async create(
    agencyId: string,
    userId: string,
    input: {
      opportunity_id: string;
      property_id: string;
      relation: PropertyLinkRelation;
      status: PropertyLinkStatus | null;
      /** Only on a rejected candidate. */
      rejected_reason?: string | null;
      /** Set on insert only (AD-060); the column is not updatable. */
      source?: PropertyLinkSource;
    },
  ): Promise<OpportunityProperty> {
    const { data, error } = await this.db
      .from('opportunity_properties')
      .insert({ ...input, agency_id: agencyId, created_by: userId })
      .select()
      .single();

    if (error) throw linkWriteFailure(error);
    return data as OpportunityProperty;
  }

  /** Null when the link isn't the agency's (or no longer exists). */
  async updateStatus(
    id: string,
    agencyId: string,
    changes: { status: PropertyLinkStatus; rejected_reason: string | null },
  ): Promise<OpportunityProperty | null> {
    const { data, error } = await this.db
      .from('opportunity_properties')
      .update(changes)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .eq('relation', 'candidate')
      .select()
      .maybeSingle();

    if (error) throw linkWriteFailure(error);
    return data as OpportunityProperty | null;
  }

  /** The removed link, or null when there was none. */
  async delete(id: string, agencyId: string): Promise<OpportunityProperty | null> {
    const { data, error } = await this.db
      .from('opportunity_properties')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .maybeSingle();

    if (error) throw new DomainError('errors.deleteFailed', `Failed to remove property link: ${error.message}`);
    return data as OpportunityProperty | null;
  }
}
