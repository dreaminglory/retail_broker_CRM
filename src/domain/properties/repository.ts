import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { Property } from './types';
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

  /** The newest active properties. */
  async findRecent(agencyId: string, limit: number): Promise<Property[]> {
    const { data, error } = await this.db
      .from('properties')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .order('code', { ascending: false })
      .limit(limit);

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch properties: ${error.message}`);
    return (data ?? []) as Property[];
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
