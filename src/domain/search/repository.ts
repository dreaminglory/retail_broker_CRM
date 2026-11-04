import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { SearchResult } from './types';

/**
 * Every word as a prefix, all required. A bare number also matches its "+" form, so 359…
 * finds +359…; a leading "#" is dropped, so "#1042" finds property 1042.
 */
function toPrefixQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^#/, '').replace(/'/g, "''"))
    .filter(Boolean)
    .map((word) => (/^\d+$/.test(word) ? `('+${word}':* | '${word}':*)` : `'${word}':*`))
    .join(' & ');
}

export class SearchRepository {
  constructor(private readonly db: SupabaseClient) {}

  async searchContacts(agencyId: string, query: string): Promise<SearchResult[]> {
    const tsQuery = toPrefixQuery(query);
    if (!tsQuery) return [];

    const { data, error } = await this.db
      .from('contacts')
      .select('id, display_name, type')
      .eq('agency_id', agencyId)
      .textSearch('search_vector', tsQuery)
      .limit(5);

    if (error) {
      throw new DomainError('errors.loadFailed', `Global search failed: ${error.message}`);
    }
    if (!data) return [];

    return data.map((c) => ({
      id: c.id,
      type: 'contact',
      title: c.display_name || null,
      subtitle: null,
      kind: c.type,
      url: `/contacts/${c.id}`,
      relevance: 1, // Without RPC we can't easily get ts_rank, so we'll just set it to 1
    }));
  }

  async searchOpportunities(agencyId: string, query: string): Promise<SearchResult[]> {
    const tsQuery = toPrefixQuery(query);
    if (!tsQuery) return [];

    const { data, error } = await this.db
      .from('opportunities')
      .select('id, title, type')
      .eq('agency_id', agencyId)
      .textSearch('search_vector', tsQuery)
      .limit(5);

    if (error) {
      throw new DomainError('errors.loadFailed', `Global search failed: ${error.message}`);
    }
    if (!data) return [];

    return data.map((o) => ({
      id: o.id,
      type: 'opportunity',
      title: o.title,
      subtitle: null,
      kind: o.type,
      url: `/opportunities/${o.id}`,
      relevance: 1,
    }));
  }

  async searchInquiries(agencyId: string, query: string): Promise<SearchResult[]> {
    const tsQuery = toPrefixQuery(query);
    if (!tsQuery) return [];

    const { data, error } = await this.db
      .from('inquiries')
      .select('id, caller_name, subject')
      .eq('agency_id', agencyId)
      .textSearch('search_vector', tsQuery)
      .limit(5);

    if (error) {
      throw new DomainError('errors.loadFailed', `Global search failed: ${error.message}`);
    }
    if (!data) return [];

    return data.map((i) => ({
      id: i.id,
      type: 'inquiry',
      title: i.caller_name || null,
      subtitle: i.subject || null,
      kind: null,
      url: `/inquiries?search=${encodeURIComponent(i.caller_name || i.subject || '')}`, // Temporary jump using readable text
      relevance: 1,
    }));
  }

  /** By code, address, area or settlement (properties.search_vector). */
  async searchProperties(agencyId: string, query: string): Promise<SearchResult[]> {
    const tsQuery = toPrefixQuery(query);
    if (!tsQuery) return [];

    const { data, error } = await this.db
      .from('properties')
      .select('id, code, address')
      .eq('agency_id', agencyId)
      .textSearch('search_vector', tsQuery)
      .order('code', { ascending: false })
      .limit(5);

    if (error) {
      throw new DomainError('errors.loadFailed', `Global search failed: ${error.message}`);
    }

    return (data ?? []).map((p) => ({
      id: p.id,
      type: 'property',
      title: `#${p.code}`,
      subtitle: p.address || null,
      kind: null,
      url: `/properties/${p.id}`,
      relevance: 1,
    }));
  }
}
