import type { ListingStatus, OfferType } from '@/domain/listings/types';
import type { PropertyFormValues } from '@/domain/properties/validation';
import type { SettlementRow } from '@/domain/settlements/types';
import { parseDate } from './csv/date-parse';
import { normalizeSettlementName } from './csv/property-resolvers';
import { parsePropertyAttributes, type PropertyCandidate } from './csv/row-mapper';
import { resolveAssignee } from './csv/value-resolvers';
import { normalizePhone } from '@/domain/contacts/phone';
import type { ImportError } from './types';
import { DomainError } from '@/lib/errors';

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

  // A municipality or province that matches none of the candidates contradicts the name: it
  // is never dropped so the other one can pick (that would be a guess).
  const byMunicipality = narrow(byName, row.municipality, MUNICIPALITY_PREFIX, (s) => [s.municipality_bg, s.municipality_en]);
  const narrowed = narrow(byMunicipality, row.province, PROVINCE_PREFIX, (s) => [s.province_bg, s.province_en]);
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
  /** `options.default_assigned_to`, else the importer (`resolveDefaultAssignee`). */
  defaultAssignee: string;
  /** `options.date_format`; without it, slashed dates are read day first. */
  dateFormat?: string;
};

/**
 * The assignee of rows without their own: the job default, which must be an active member of
 * the agency (a stale id would fail every row at commit), else the importer.
 */
export function resolveDefaultAssignee(
  jobDefault: string | null | undefined,
  importerId: string,
  members: { user_id: string }[],
): string {
  if (!jobDefault) return importerId;
  if (!members.some((m) => m.user_id === jobDefault)) {
    throw new DomainError('import.errors.unknownDefaultAssignee', `Default assignee ${jobDefault} is not an active member`);
  }
  return jobDefault;
}

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
    const parsed = parseDate(candidate.listed_at, undefined, ctx.dateFormat);
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

// ── Duplicates and owners (Task 4) ───────────────────────────────────────────

export type NewOwner = { first_name: string; last_name: string | null; phone: string | null; email: string | null };

/** What the service looked up for one page of rows, all in the caller's agency. */
export type PropertyLookups = {
  /** external_ref → existing property id. */
  refs: Map<string, string>;
  /** row number → its address key and the existing property with that key in its settlement. */
  addresses: Map<number, { key: string; property_id: string | null }>;
  /** E.164 phone → contact id, and lowercase email → contact id. */
  phones: Map<string, string>;
  emails: Map<string, string>;
  contactNames: Map<string, string>;
};

/** What earlier rows of the same file claimed, carried across pages. */
export type ClassifyState = { refs: Set<string>; addresses: Set<string> };

export type ClassifiedPropertyRow = {
  status: 'valid' | 'invalid' | 'duplicate' | 'skipped';
  normalized: (NormalizedPropertyRow & OwnerFields) | null;
  errors: ImportError[];
  match_reason: 'external_ref' | 'address' | 'in_file' | null;
  matched_entity_id: string | null;
};

type OwnerFields = {
  owner_contact_id: string | null;
  owner_display_name: string | null;
  new_owner: NewOwner | null;
};

/** The owner's phone as E.164 and email lowercase; `phoneInvalid` when a phone is there but doesn't parse. */
export function ownerMethods(candidate: PropertyCandidate): { phone: string | null; email: string | null; phoneInvalid: boolean } {
  const phone = candidate.owner_phone ? normalizePhone(candidate.owner_phone) : null;
  return {
    phone,
    email: candidate.owner_email ? candidate.owner_email.trim().toLowerCase() : null,
    phoneInvalid: !!candidate.owner_phone && phone === null,
  };
}

/** Split as the contact import does: the first word is the first name, the rest the last name. */
function splitName(name: string): { first_name: string; last_name: string | null } {
  const parts = name.trim().split(/\s+/);
  return { first_name: parts[0], last_name: parts.length > 1 ? parts.slice(1).join(' ') : null };
}

/**
 * Rules 4 and 6, applied to a row in file order after `validatePropertyRow`:
 * 1. the owner phone must parse, and a new owner needs a name (we never invent one);
 * 2. an `external_ref` an existing property or an earlier row has → `skipped`;
 * 3. an address key an existing property in the settlement has → `duplicate` / `address`,
 *    or an earlier row with the same settlement and key → `duplicate` / `in_file`;
 * 4. the owner is matched by phone, then email; otherwise a new contact (name-only owners are
 *    never matched).
 */
export function classifyPropertyRow(
  rowNumber: number,
  candidate: PropertyCandidate,
  validated: PropertyRowResult,
  lookups: PropertyLookups,
  state: ClassifyState,
): ClassifiedPropertyRow {
  const invalid = (errors: ImportError[]): ClassifiedPropertyRow => ({
    status: 'invalid', normalized: null, errors, match_reason: null, matched_entity_id: null,
  });

  const methods = ownerMethods(candidate);
  const errors = [...validated.errors];
  if (methods.phoneInvalid) errors.push({ field: 'owner_phone', code: 'import.errors.ownerPhoneInvalid' });
  if (validated.status === 'invalid' || !validated.normalized || errors.length > 0) return invalid(errors);

  const matchedOwner =
    (methods.phone && lookups.phones.get(methods.phone)) || (methods.email && lookups.emails.get(methods.email)) || null;
  let owner: OwnerFields = { owner_contact_id: null, owner_display_name: null, new_owner: null };
  if (matchedOwner) {
    owner = { owner_contact_id: matchedOwner, owner_display_name: lookups.contactNames.get(matchedOwner) ?? null, new_owner: null };
  } else if (candidate.owner_name) {
    owner = { ...owner, new_owner: { ...splitName(candidate.owner_name), phone: methods.phone, email: methods.email } };
  } else if (methods.phone || methods.email) {
    return invalid([{ field: 'owner_name', code: 'import.errors.ownerNameRequired' }]);
  }

  const normalized = { ...validated.normalized, ...owner };
  const result = (
    status: ClassifiedPropertyRow['status'],
    match_reason: ClassifiedPropertyRow['match_reason'] = null,
    matched_entity_id: string | null = null,
  ): ClassifiedPropertyRow => ({ status, normalized, errors: [], match_reason, matched_entity_id });

  const ref = candidate.external_ref;
  if (ref) {
    const existing = lookups.refs.get(ref);
    const earlier = state.refs.has(ref);
    state.refs.add(ref);
    if (existing) return result('skipped', 'external_ref', existing);
    if (earlier) return result('skipped', 'external_ref');
  }

  const address = lookups.addresses.get(rowNumber);
  if (address) {
    const key = `${normalized.property.settlement_id}|${address.key}`;
    const earlier = state.addresses.has(key);
    state.addresses.add(key);
    if (address.property_id) return result('duplicate', 'address', address.property_id);
    if (earlier) return result('duplicate', 'in_file');
  }

  return result('valid');
}
