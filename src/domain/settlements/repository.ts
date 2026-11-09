import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import { escapeLikePattern } from '@/domain/contacts/validation';
import type { SettlementRow } from './types';
import { settlementNameColumn } from './validation';

// Each name is two percent-encoded Cyrillic filters (~20 bytes a letter): 10 keep the URL short.
const NAME_CHUNK = 10;
const CODE_CHUNK = 200;
const ID_CHUNK = 100;

/** Settlements are global: no agency filter, RLS lets every signed-in user read them. */
export class SettlementRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** Name prefix search, towns before villages, at most `limit` rows. */
  async searchByPrefix(query: string, limit: number): Promise<SettlementRow[]> {
    const pattern = escapeLikePattern(query);
    if (!pattern) return [];
    const { data, error } = await this.db
      .from('settlements')
      .select('*')
      .ilike(settlementNameColumn(query), `${pattern}%`)
      .order('kind', { ascending: true })
      .order('name_bg', { ascending: true })
      .order('ekatte', { ascending: true })
      .limit(limit);

    if (error) throw new DomainError('errors.loadFailed', `Failed to search settlements: ${error.message}`);
    return (data ?? []) as SettlementRow[];
  }

  async findByIds(ids: string[]): Promise<SettlementRow[]> {
    const found: SettlementRow[] = [];
    const unique = [...new Set(ids)];
    // Ids go in the URL: 100 at a time keeps it short (a property import names many villages).
    for (let i = 0; i < unique.length; i += ID_CHUNK) {
      const { data, error } = await this.db.from('settlements').select('*').in('id', unique.slice(i, i + ID_CHUNK));
      if (error) throw new DomainError('errors.loadFailed', `Failed to fetch settlements: ${error.message}`);
      found.push(...((data ?? []) as SettlementRow[]));
    }
    return found;
  }

  /**
   * Every settlement whose Bulgarian or English name equals one of `names` (any case), or whose
   * EKATTE code is in `codes`: the candidates for property import rule 2. Names come in
   * normalised (no `гр.`/`с.`); chunked so the request URL stays short.
   */
  async findByNamesOrCodes(names: string[], codes: string[]): Promise<SettlementRow[]> {
    const found = new Map<string, SettlementRow>();
    const keep = (rows: SettlementRow[] | null) => (rows ?? []).forEach((row) => found.set(row.id, row));

    // A double quote or backslash would break the PostgREST filter; no settlement has one.
    const safeNames = [...new Set(names)].filter((name) => name && !/["\\,()]/.test(name));
    for (let i = 0; i < safeNames.length; i += NAME_CHUNK) {
      const filter = safeNames
        .slice(i, i + NAME_CHUNK)
        .flatMap((name) => {
          const pattern = escapeLikePattern(name);
          return [`name_bg.ilike."${pattern}"`, `name_en.ilike."${pattern}"`];
        })
        .join(',');
      const { data, error } = await this.db.from('settlements').select('*').or(filter);
      if (error) throw new DomainError('errors.loadFailed', `Failed to fetch settlements: ${error.message}`);
      keep(data as SettlementRow[]);
    }

    const uniqueCodes = [...new Set(codes)];
    for (let i = 0; i < uniqueCodes.length; i += CODE_CHUNK) {
      const { data, error } = await this.db.from('settlements').select('*').in('ekatte', uniqueCodes.slice(i, i + CODE_CHUNK));
      if (error) throw new DomainError('errors.loadFailed', `Failed to fetch settlements: ${error.message}`);
      keep(data as SettlementRow[]);
    }

    return [...found.values()];
  }
}
