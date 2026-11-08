import type { ListingStatus, OfferType } from '@/domain/listings/types';
import type { PropertyFormValues } from '@/domain/properties/validation';
import type { SettlementRow } from '@/domain/settlements/types';
import { parseDate } from './csv/date-parse';
import { normalizeSettlementName } from './csv/property-resolvers';
import { parsePropertyAttributes, type PropertyCandidate } from './csv/row-mapper';
import { resolveAssignee } from './csv/value-resolvers';
import type { ImportError } from './types';

/**
 * Property row validation (spec: property-import rules 1–3 and 5, AD-064). Pure: the service
 * loads the settlements, areas and members and passes them in. Duplicates and owners are
 * added by the service afterwards (Task 4).
 */

export type SettlementQuery = { code: string } | { name: string };

/** What to look a settlement cell up by: a five-digit EKATTE code, or the name without `гр.`/`с.`. */
export function settlementLookup(value: string | null | undefined): SettlementQuery | null {
  const text = value?.trim();
  if (!text) return null;
  if (/^\d{5}$/.test(text)) return { code: text };
  const name = normalizeSettlementName(text);
  return name ? { name } : null;
}

export type SettlementResolution =
  | { id: string }
  | { error: 'import.errors.settlementNotFound' | 'import.errors.settlementAmbiguous'; candidates: string[] };

const lower = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

// "Община Любимец", "общ. Любимец" → "любимец"; "обл. Хасково", "София (столица)" → "хасково", "софия".
const regionName = (value: string, prefixes: RegExp) =>
  lower(value).replace(prefixes, '').replace(/\(.*?\)/g, '').trim();
const MUNICIPALITY_PREFIX = /^(община|общ\.?)\s*/;
const PROVINCE_PREFIX = /^(област|обл\.?)\s*/;

function narrow(
  candidates: SettlementRow[],
  value: string | null,
  prefixes: RegExp,
  pick: (s: SettlementRow) => string[],
): SettlementRow[] {
  if (!value?.trim()) return candidates;
  const wanted = regionName(value, prefixes);
  return candidates.filter((s) => pick(s).some((name) => regionName(name, prefixes) === wanted));
}

/**
 * Rule 2. A code or a unique name resolves; several settlements with the name must be narrowed
 * to exactly one by the municipality, then the province. Anything else is an error that names
 * the candidates' municipalities. Never picked by order.
 */
export function resolveSettlement(
  row: { settlement: string | null; municipality: string | null; province: string | null },
  settlements: SettlementRow[],
): SettlementResolution {
  const query = settlementLookup(row.settlement);
  if (!query) return { error: 'import.errors.settlementNotFound', candidates: [] };

  if ('code' in query) {
    const match = settlements.find((s) => s.ekatte === query.code);
    return match ? { id: match.id } : { error: 'import.errors.settlementNotFound', candidates: [] };
  }

  const byName = settlements.filter((s) => lower(s.name_bg) === query.name || lower(s.name_en) === query.name);
  if (byName.length === 0) return { error: 'import.errors.settlementNotFound', candidates: [] };
  if (byName.length === 1) return { id: byName[0].id };

  let narrowed = narrow(byName, row.municipality, MUNICIPALITY_PREFIX, (s) => [s.municipality_bg, s.municipality_en]);
  if (narrowed.length === 0) narrowed = byName;
  narrowed = narrow(narrowed, row.province, PROVINCE_PREFIX, (s) => [s.province_bg, s.province_en]);
  if (narrowed.length === 1) return { id: narrowed[0].id };

  const left = narrowed.length > 0 ? narrowed : byName;
  return { error: 'import.errors.settlementAmbiguous', candidates: left.map((s) => s.municipality_bg) };
}

/** Rows of one file share a new area by this key; `options.create_areas` stores the kept ones. */
export function areaKey(settlementId: string, name: string): string {
  return `${settlementId}:${lower(name)}`;
}

export type NormalizedListing = {
  offer_type: OfferType;
  price: number;
  status: ListingStatus;
  listed_at: string | null;
};

export type NormalizedPropertyRow = {
  property: PropertyFormValues & { external_ref: string | null };
  new_area: { settlement_id: string; name: string; key: string } | null;
  listings: NormalizedListing[];
  bgn_converted: boolean;
};

export type PropertyRowContext = {
  settlements: SettlementRow[];
  /** Existing areas of the agency, keyed by `areaKey`, active or not. */
  areas: Map<string, string>;
  members: { user_id: string; email?: string | null; display_name?: string | null }[];
  /** `options.default_assigned_to`, else the importer. */
  defaultAssignee: string | null;
};

export type PropertyRowResult = {
  status: 'valid' | 'invalid';
  normalized: NormalizedPropertyRow | null;
  errors: ImportError[];
};

export function validatePropertyRow(candidate: PropertyCandidate, ctx: PropertyRowContext): PropertyRowResult {
  const errors: ImportError[] = [];

  const settlement = resolveSettlement(candidate, ctx.settlements);
  const settlementId = 'id' in settlement ? settlement.id : null;
  if ('error' in settlement) {
    errors.push({
      field: 'settlement',
      code: settlement.error,
      ...(settlement.candidates.length > 0 && { detail: settlement.candidates.join(', ') }),
    });
  }

  let areaId: string | null = null;
  let newArea: NormalizedPropertyRow['new_area'] = null;
  if (settlementId && candidate.area) {
    const key = areaKey(settlementId, candidate.area);
    areaId = ctx.areas.get(key) ?? null;
    if (!areaId) newArea = { settlement_id: settlementId, name: candidate.area, key };
  }

  let assignedTo = ctx.defaultAssignee;
  if (candidate.assigned_to) {
    const resolved = resolveAssignee(candidate.assigned_to, ctx.members, null);
    if (resolved) assignedTo = resolved;
    else errors.push({ field: 'assigned_to', code: 'import.errors.unknownAssignee' });
  }

  const listings: NormalizedListing[] = [];
  let bgnConverted = false;
  const prices: [OfferType, PropertyCandidate['sale_price'], string][] = [
    ['sale', candidate.sale_price, 'sale_price'],
    ['rent', candidate.rent_price, 'rent_price'],
  ];
  const hasPrice = prices.some(([, price]) => price !== null);

  let listedAt: string | null = null;
  if (hasPrice && candidate.listed_at) {
    const parsed = parseDate(candidate.listed_at);
    if (parsed) listedAt = parsed.toISOString();
    else errors.push({ field: 'listed_at', code: 'import.errors.invalidDate' });
  }
  if (hasPrice && candidate.listing_status === null) {
    errors.push({ field: 'listing_status', code: 'import.errors.invalidListingStatus' });
  }

  for (const [offerType, price, field] of prices) {
    if (price === null) continue;
    if (!price.ok) {
      errors.push({ field, code: 'import.errors.invalidPrice' });
      continue;
    }
    bgnConverted ||= price.converted;
    listings.push({ offer_type: offerType, price: price.amount, status: candidate.listing_status ?? 'active', listed_at: listedAt });
  }

  const attributes = parsePropertyAttributes(candidate, { settlement_id: settlementId, area_id: areaId, assigned_to: assignedTo });
  if (!attributes.success) {
    // A settlement that didn't resolve already has its own, more useful error.
    errors.push(...attributes.errors.filter((e) => !(settlementId === null && e.field === 'settlement_id')));
  }

  if (errors.length > 0 || !attributes.success) {
    return { status: 'invalid', normalized: null, errors };
  }

  return {
    status: 'valid',
    normalized: {
      property: { ...attributes.data, external_ref: candidate.external_ref },
      new_area: newArea,
      listings,
      bgn_converted: bgnConverted,
    },
    errors: [],
  };
}
