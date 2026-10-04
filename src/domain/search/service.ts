import type { SupabaseClient } from '@supabase/supabase-js';
import { SearchRepository } from './repository';
import type { SearchResult } from './types';

export class SearchService {
  private readonly repo: SearchRepository;

  constructor(db: SupabaseClient) {
    this.repo = new SearchRepository(db);
  }

  async globalSearch(agencyId: string, query: string): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const trimmedQuery = query.trim();

    // Execute searches in parallel
    const [contacts, opportunities, inquiries] = await Promise.all([
      this.repo.searchContacts(agencyId, trimmedQuery),
      this.repo.searchOpportunities(agencyId, trimmedQuery),
      this.repo.searchInquiries(agencyId, trimmedQuery),
    ]);

    // Combine and sort (we don't have real relevance scores without RPC, so we just group them for now)
    const results = [...contacts, ...opportunities, ...inquiries];

    return results;
  }
}
