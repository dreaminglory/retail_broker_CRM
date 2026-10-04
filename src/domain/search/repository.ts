import type { SupabaseClient } from '@supabase/supabase-js';
import type { SearchResult } from './types';

export class SearchRepository {
  constructor(private readonly db: SupabaseClient) {}

  async searchContacts(agencyId: string, query: string): Promise<SearchResult[]> {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    
    // Add a '+' to numeric searches if it's missing, to allow matching +359 with just 359
    const tsQuery = words.map(word => {
      const sanitized = word.replace(/'/g, "''");
      const isNumeric = /^\d+$/.test(sanitized);
      return isNumeric ? `('+${sanitized}':* | '${sanitized}':*)` : `'${sanitized}':*`;
    }).join(' & ');
    const { data, error } = await this.db
      .from('contacts')
      .select('id, display_name, type')
      .eq('agency_id', agencyId)
      .textSearch('search_vector', tsQuery)
      .limit(5);

    if (error) {
      console.error('[SearchContacts] Error:', error);
      throw error;
    }
    if (!data) return [];

    return data.map((c) => ({
      id: c.id,
      type: 'contact',
      title: c.display_name || 'Unnamed Contact',
      subtitle: c.type === 'organization' ? 'Company' : 'Person',
      url: `/contacts/${c.id}`,
      relevance: 1, // Without RPC we can't easily get ts_rank, so we'll just set it to 1
    }));
  }

  async searchOpportunities(agencyId: string, query: string): Promise<SearchResult[]> {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    
    const tsQuery = words.map(word => {
      const sanitized = word.replace(/'/g, "''");
      const isNumeric = /^\d+$/.test(sanitized);
      return isNumeric ? `('+${sanitized}':* | '${sanitized}':*)` : `'${sanitized}':*`;
    }).join(' & ');
    const { data, error } = await this.db
      .from('opportunities')
      .select('id, title, type')
      .eq('agency_id', agencyId)
      .textSearch('search_vector', tsQuery)
      .limit(5);

    if (error) {
      console.error('[SearchOpportunities] Error:', error);
      throw error;
    }
    if (!data) return [];

    return data.map((o) => ({
      id: o.id,
      type: 'opportunity',
      title: o.title,
      subtitle: o.type ? o.type.charAt(0).toUpperCase() + o.type.slice(1) : null,
      url: `/opportunities/${o.id}`,
      relevance: 1,
    }));
  }

  async searchInquiries(agencyId: string, query: string): Promise<SearchResult[]> {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    
    const tsQuery = words.map(word => {
      const sanitized = word.replace(/'/g, "''");
      const isNumeric = /^\d+$/.test(sanitized);
      return isNumeric ? `('+${sanitized}':* | '${sanitized}':*)` : `'${sanitized}':*`;
    }).join(' & ');
    const { data, error } = await this.db
      .from('inquiries')
      .select('id, caller_name, subject')
      .eq('agency_id', agencyId)
      .textSearch('search_vector', tsQuery)
      .limit(5);

    if (error) {
      console.error('[SearchInquiries] Error:', error);
      throw error;
    }
    if (!data) return [];

    return data.map((i) => ({
      id: i.id,
      type: 'inquiry',
      title: i.caller_name || 'Unknown Caller',
      subtitle: i.subject || null,
      url: `/inquiries?search=${encodeURIComponent(i.caller_name || i.subject || '')}`, // Temporary jump using readable text
      relevance: 1,
    }));
  }
}
