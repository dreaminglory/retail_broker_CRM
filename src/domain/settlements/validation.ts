import { z } from 'zod';

export const settlementQuerySchema = z.string().trim().max(100);

/** Cyrillic text searches the Bulgarian name, anything else the transliterated one. */
export function settlementNameColumn(query: string): 'name_bg' | 'name_en' {
  return /[Ѐ-ӿ]/.test(query) ? 'name_bg' : 'name_en';
}
