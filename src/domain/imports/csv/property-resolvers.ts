import type { ListingStatus } from '@/domain/listings/types';
import type { Construction, PropertyType } from '@/domain/properties/types';

/** Fixed lev-to-euro rate (spec: property-import rule 5, Q1). */
export const BGN_PER_EUR = 1.95583;

const clean = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
};

const TYPE_WORDS: Record<string, PropertyType> = {
  апартамент: 'apartment',
  apartment: 'apartment',
  студио: 'studio',
  studio: 'studio',
  мезонет: 'maisonette',
  maisonette: 'maisonette',
  къща: 'house',
  house: 'house',
  'етаж от къща': 'house_floor',
  house_floor: 'house_floor',
  'house floor': 'house_floor',
  парцел: 'plot',
  plot: 'plot',
  гараж: 'garage',
  garage: 'garage',
};

// "двустаен" is how Bulgarian listings name an apartment by its rooms; "многостаен" is 5+.
const ROOM_WORDS: Record<string, number> = {
  едностаен: 1,
  двустаен: 2,
  тристаен: 3,
  четиристаен: 4,
  петстаен: 5,
  многостаен: 5,
};

export function resolvePropertyType(
  value: string | null | undefined,
): { type: PropertyType; rooms: number | null } | null {
  const text = clean(value)?.toLowerCase();
  if (!text) return null;
  if (TYPE_WORDS[text]) return { type: TYPE_WORDS[text], rooms: null };
  if (ROOM_WORDS[text]) return { type: 'apartment', rooms: ROOM_WORDS[text] };
  return null;
}

const UNIT_SUFFIX = /\s*(кв\.?\s*м\.?|кв\.?|m²|м²|m2|м2|sqm)\s*$/i;

/**
 * A number as spreadsheets write it: `68,5`, `68.5 кв.м`, `1 200`, `185,000`, `185.000`, `1.200,50`.
 * Blank is null; anything else that isn't a number is NaN, so the property schema reports
 * its own `validation.number_invalid`.
 */
export function parseNumber(value: string | null | undefined): number | null {
  const text = clean(value);
  if (!text) return null;

  let s = text.replace(UNIT_SUFFIX, '').replace(/[\s  ]/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // The separator that comes last is the decimal one.
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // `185.000` is 185 000, as `185,000` is: nothing we import has three decimals.
    s = s.replace(/\./g, '');
  }

  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}

export function resolveFloor(value: string | null | undefined): number | null {
  const text = clean(value)?.toLowerCase();
  if (!text) return null;
  if (['партер', 'ground', 'ground floor'].includes(text)) return 0;
  if (['сутерен', 'basement'].includes(text)) return -1;
  // "3-ти", "5 ет." — a number followed by a Bulgarian ordinal or "ет."
  const ordinal = /^(-?\d+)(\s*-?\s*[а-я.]+)?$/.exec(text);
  if (ordinal) return Number(ordinal[1]);
  return parseNumber(text);
}

const CONSTRUCTION_WORDS: Record<string, Construction> = {
  тухла: 'brick',
  brick: 'brick',
  панел: 'panel',
  panel: 'panel',
  епк: 'epk',
  epk: 'epk',
  гредоред: 'timber',
  дърво: 'timber',
  timber: 'timber',
};

/** Known words map to their construction; any other text is `other`, blank is null. */
export function resolveConstruction(value: string | null | undefined): Construction | null {
  const text = clean(value)?.toLowerCase();
  if (!text) return null;
  return CONSTRUCTION_WORDS[text] ?? 'other';
}

export type ParsedPrice = { ok: true; amount: number; converted: boolean } | { ok: false };

const BGN_MARK = /(лв\.?|лева|bgn)/i;
const EUR_MARK = /(€|eur|евро)/gi;

/**
 * A price in EUR (AD-037). An amount marked лв/BGN is converted at 1.95583 and rounded to the
 * cent. Blank is null; garbage, zero or a negative amount is `{ ok: false }`.
 */
export function parsePrice(value: string | null | undefined): ParsedPrice | null {
  const text = clean(value);
  if (!text) return null;
  const converted = BGN_MARK.test(text);
  const amount = parseNumber(text.replace(BGN_MARK, '').replace(EUR_MARK, ''));
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { ok: false };
  const eur = converted ? amount / BGN_PER_EUR : amount;
  return { ok: true, amount: Math.round(eur * 100) / 100, converted };
}

const LISTING_STATUS_WORDS: Record<string, ListingStatus> = {
  активна: 'active',
  активен: 'active',
  active: 'active',
  резервирана: 'reserved',
  резервиран: 'reserved',
  reserved: 'reserved',
  продадена: 'closed',
  продаден: 'closed',
  отдадена: 'closed',
  отдаден: 'closed',
  closed: 'closed',
  sold: 'closed',
  rented: 'closed',
  оттеглена: 'withdrawn',
  оттеглен: 'withdrawn',
  withdrawn: 'withdrawn',
};

/** Blank is `active` (the default); unknown text is null, never a guess. */
export function resolveListingStatus(value: string | null | undefined): ListingStatus | null {
  const text = clean(value)?.toLowerCase();
  if (!text) return 'active';
  return LISTING_STATUS_WORDS[text] ?? null;
}

/** The settlement name without `гр.`/`с.`/`град`/`село`, lowercase, single-spaced. */
export function normalizeSettlementName(value: string | null | undefined): string | null {
  const text = clean(value)?.toLowerCase();
  if (!text) return null;
  const stripped = text.replace(/^(гр|с)\.\s*/, '').replace(/^(град|село|гр|с)\s+/, '').trim();
  return stripped === '' ? null : stripped;
}

/** An area name as it will be shown and created: trimmed and single-spaced. */
export function normalizeAreaName(value: string | null | undefined): string | null {
  return clean(value);
}
