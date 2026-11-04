import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { SettlementRepository } from './repository';
import type { Settlement, SettlementRow } from './types';
import { settlementQuerySchema } from './validation';

const SEARCH_LIMIT = 20;

/** The row with its names in the user's locale (rule 9). */
export function toSettlement(row: SettlementRow, locale: Locale): Settlement {
  const bg = locale === 'bg';
  return {
    id: row.id,
    kind: row.kind,
    name: bg ? row.name_bg : row.name_en,
    municipality: bg ? row.municipality_bg : row.municipality_en,
    province: bg ? row.province_bg : row.province_en,
  };
}

export class SettlementService {
  private readonly repo: SettlementRepository;

  constructor(db: SupabaseClient) {
    this.repo = new SettlementRepository(db);
  }

  /** For the picker: "плов" or "plov" both find Plovdiv, shown in `locale`. */
  async search(query: string, locale: Locale): Promise<Settlement[]> {
    const text = settlementQuerySchema.parse(query);
    if (!text) return [];
    const rows = await this.repo.searchByPrefix(text, SEARCH_LIMIT);
    return rows.map((row) => toSettlement(row, locale));
  }

  async getById(id: string, locale: Locale): Promise<Settlement | null> {
    const [row] = await this.repo.findByIds([id]);
    return row ? toSettlement(row, locale) : null;
  }

  async getByIds(ids: string[], locale: Locale): Promise<Settlement[]> {
    const rows = await this.repo.findByIds([...new Set(ids)]);
    return rows.map((row) => toSettlement(row, locale));
  }
}
