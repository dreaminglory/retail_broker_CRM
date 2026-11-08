import { describe, expect, it } from 'vitest';
import type { SettlementRow } from '@/domain/settlements/types';
import { mapRowToPropertyCandidate } from './csv/row-mapper';
import {
  areaKey,
  classifyPropertyRow,
  type ClassifyState,
  type PropertyLookups,
  resolveDefaultAssignee,
  resolveSettlement,
  settlementLookup,
  validatePropertyRow,
  type PropertyRowContext,
} from './property-validation';

const settlement = (over: Partial<SettlementRow>): SettlementRow => ({
  id: over.ekatte ?? 'x',
  ekatte: '00000',
  kind: 'village',
  name_bg: 'Лозен',
  name_en: 'Lozen',
  municipality_bg: 'Столична',
  municipality_en: 'Stolichna',
  province_bg: 'София (столица)',
  province_en: 'Sofia (stolitsa)',
  ...over,
});

const LOZEN_SOFIA = settlement({ id: '00000000-0000-4000-8000-000000000001', ekatte: '44063' });
const LOZEN_HASKOVO = settlement({ id: '00000000-0000-4000-8000-000000000002', ekatte: '44077', municipality_bg: 'Любимец', municipality_en: 'Lyubimets', province_bg: 'Хасково', province_en: 'Haskovo' });
const LOZEN_SZ = settlement({ id: '00000000-0000-4000-8000-000000000003', ekatte: '63149', municipality_bg: 'Стара Загора', municipality_en: 'Stara Zagora', province_bg: 'Стара Загора', province_en: 'Stara Zagora' });
const LOZEN_SZ2 = settlement({ id: '00000000-0000-4000-8000-000000000004', ekatte: '63150', municipality_bg: 'Гурково', municipality_en: 'Gurkovo', province_bg: 'Стара Загора', province_en: 'Stara Zagora' });
const SOFIA = settlement({ id: '00000000-0000-4000-8000-000000000005', ekatte: '68134', kind: 'city', name_bg: 'София', name_en: 'Sofia' });
const ALL = [LOZEN_SOFIA, LOZEN_HASKOVO, LOZEN_SZ, LOZEN_SZ2, SOFIA];

describe('settlementLookup', () => {
  it('reads a five-digit EKATTE code or a name without its prefix', () => {
    expect(settlementLookup('44063')).toEqual({ code: '44063' });
    expect(settlementLookup('с. Лозен')).toEqual({ name: 'лозен' });
    expect(settlementLookup('  ')).toBeNull();
  });
});

describe('resolveSettlement', () => {
  it('is ambiguous when several settlements share the name, listing their municipalities', () => {
    expect(resolveSettlement({ settlement: 'Лозен', municipality: null, province: null }, ALL)).toEqual({
      error: 'import.errors.settlementAmbiguous',
      candidates: ['Столична', 'Любимец', 'Стара Загора', 'Гурково'],
    });
  });

  it('resolves with the municipality, in Bulgarian or English and with its prefix', () => {
    expect(resolveSettlement({ settlement: 'Лозен', municipality: 'Столична', province: null }, ALL)).toEqual({ id: '00000000-0000-4000-8000-000000000001' });
    expect(resolveSettlement({ settlement: 'Lozen', municipality: 'Lyubimets', province: null }, ALL)).toEqual({ id: '00000000-0000-4000-8000-000000000002' });
    expect(resolveSettlement({ settlement: 'с. Лозен', municipality: 'Община Любимец', province: null }, ALL)).toEqual({ id: '00000000-0000-4000-8000-000000000002' });
  });

  it('resolves with the province when it leaves one', () => {
    expect(resolveSettlement({ settlement: 'Лозен', municipality: null, province: 'Хасково' }, ALL)).toEqual({ id: '00000000-0000-4000-8000-000000000002' });
  });

  it('stays ambiguous when the province leaves several', () => {
    expect(resolveSettlement({ settlement: 'Лозен', municipality: null, province: 'обл. Стара Загора' }, ALL)).toEqual({
      error: 'import.errors.settlementAmbiguous',
      candidates: ['Стара Загора', 'Гурково'],
    });
  });

  it('stays ambiguous when the municipality matches none of them', () => {
    const result = resolveSettlement({ settlement: 'Лозен', municipality: 'Варна', province: null }, ALL);
    expect(result).toMatchObject({ error: 'import.errors.settlementAmbiguous' });
  });

  it('stays ambiguous when the municipality contradicts, even if the province would pick one', () => {
    const result = resolveSettlement({ settlement: 'Лозен', municipality: 'Варна', province: 'Хасково' }, ALL);
    expect(result).toMatchObject({ error: 'import.errors.settlementAmbiguous' });
  });

  it('resolves an EKATTE code directly', () => {
    expect(resolveSettlement({ settlement: '44077', municipality: null, province: null }, ALL)).toEqual({ id: '00000000-0000-4000-8000-000000000002' });
  });

  it('resolves a unique name, in either language and any case', () => {
    expect(resolveSettlement({ settlement: 'гр. София', municipality: null, province: null }, ALL)).toEqual({ id: '00000000-0000-4000-8000-000000000005' });
    expect(resolveSettlement({ settlement: 'SOFIA', municipality: null, province: null }, ALL)).toEqual({ id: '00000000-0000-4000-8000-000000000005' });
  });

  it('is not found for an unknown name or code', () => {
    expect(resolveSettlement({ settlement: 'Атлантида', municipality: null, province: null }, ALL)).toEqual({ error: 'import.errors.settlementNotFound', candidates: [] });
    expect(resolveSettlement({ settlement: '99999', municipality: null, province: null }, ALL)).toEqual({ error: 'import.errors.settlementNotFound', candidates: [] });
  });

  it('never picks by order', () => {
    const reversed = [...ALL].reverse();
    expect(resolveSettlement({ settlement: 'Лозен', municipality: null, province: null }, reversed)).toMatchObject({ error: 'import.errors.settlementAmbiguous' });
  });
});

const mapping = {
  type: 'type', settlement: 'settlement', municipality: 'municipality', area: 'area', address: 'address',
  area_m2: 'area_m2', sale_price: 'sale', rent_price: 'rent', listing_status: 'status', listed_at: 'listed',
  assigned_to: 'broker', external_ref: 'ref',
};

const context = (over: Partial<PropertyRowContext> = {}): PropertyRowContext => ({
  settlements: ALL,
  areas: new Map([[areaKey('00000000-0000-4000-8000-000000000005', 'Лозенец'), '11111111-1111-4111-8111-000000000001']]),
  members: [
    { user_id: '22222222-2222-4222-8222-000000000001', email: 'maria@alpha.bg', display_name: 'Maria Georgieva' },
    { user_id: '22222222-2222-4222-8222-000000000002', email: 'ivan@alpha.bg', display_name: 'Ivan Petrov' },
  ],
  defaultAssignee: '22222222-2222-4222-8222-000000000009',
  ...over,
});

const validate = (cells: Record<string, string>, ctx = context()) =>
  validatePropertyRow(mapRowToPropertyCandidate(cells, mapping), ctx);

describe('validatePropertyRow', () => {
  it('resolves settlement, an existing area, the assignee and both listings', () => {
    const result = validate({
      type: 'двустаен', settlement: 'София', area: 'лозенец', address: 'ул. Яворов 12', area_m2: '68',
      sale: '185 000', rent: '900', status: '', listed: '15.03.2025', broker: 'maria@alpha.bg', ref: 'A-1042',
    });
    expect(result.status).toBe('valid');
    expect(result.errors).toEqual([]);
    expect(result.normalized).toMatchObject({
      property: {
        type: 'apartment', rooms: 2, area_m2: 68, settlement_id: '00000000-0000-4000-8000-000000000005',
        area_id: '11111111-1111-4111-8111-000000000001', address: 'ул. Яворов 12',
        assigned_to: '22222222-2222-4222-8222-000000000001', external_ref: 'A-1042',
      },
      new_area: null,
      listings: [
        { offer_type: 'sale', price: 185000, status: 'active' },
        { offer_type: 'rent', price: 900, status: 'active' },
      ],
      bgn_converted: false,
    });
    expect(result.normalized!.listings[0].listed_at).toMatch(/^2025-03-1[45]T/);
  });

  it('makes an unknown area a new area of the row settlement, keyed by settlement and name', () => {
    const result = validate({ type: 'гараж', settlement: 'София', area: '  Витоша ' });
    expect(result.normalized).toMatchObject({
      property: { area_id: null },
      new_area: { settlement_id: '00000000-0000-4000-8000-000000000005', name: 'Витоша', key: areaKey('00000000-0000-4000-8000-000000000005', 'Витоша') },
    });
    expect(areaKey('00000000-0000-4000-8000-000000000005', 'ВИТОША')).toBe(areaKey('00000000-0000-4000-8000-000000000005', 'Витоша'));
  });

  it('reads listed_at with the job date format, and ISO dates always', () => {
    const us = context({ dateFormat: 'MM/dd/yyyy' });
    // The same instant however the zone is written.
    const listedAt = (cells: Record<string, string>, ctx = context()) =>
      new Date(validate({ type: 'гараж', settlement: 'София', sale: '1000', ...cells }, ctx).normalized!.listings[0].listed_at!).toISOString();
    // 5 March 2025, midnight in Sofia (UTC+2).
    expect(listedAt({ listed: '03/05/2025' }, us)).toBe('2025-03-04T22:00:00.000Z');
    expect(listedAt({ listed: '2025-03-05' }, us)).toBe('2025-03-04T22:00:00.000Z');
    // A day over 12 doesn't fit MM/dd: an error, never a silent swap.
    expect(validate({ type: 'гараж', settlement: 'София', sale: '1000', listed: '15/03/2025' }, us).errors)
      .toEqual([{ field: 'listed_at', code: 'import.errors.invalidDate' }]);
    // Without a format, slashes are day first.
    expect(listedAt({ listed: '03/05/2025' })).toBe('2025-05-02T21:00:00.000Z');
  });

  it('defaults the assignee to the job default', () => {
    expect(validate({ type: 'гараж', settlement: 'София' }).normalized!.property.assigned_to).toBe('22222222-2222-4222-8222-000000000009');
  });

  it('counts a BGN price as converted and imports a row with no price without listings', () => {
    expect(validate({ type: 'гараж', settlement: 'София', rent: '1 200 лв.' }).normalized).toMatchObject({
      listings: [{ offer_type: 'rent', price: 613.55 }],
      bgn_converted: true,
    });
    expect(validate({ type: 'гараж', settlement: 'София' }).normalized!.listings).toEqual([]);
  });

  it('gives closed and withdrawn listings their status', () => {
    expect(validate({ type: 'гараж', settlement: 'София', sale: '20000', status: 'продадена' }).normalized!.listings[0].status).toBe('closed');
  });

  it.each([
    ['an ambiguous settlement', { type: 'гараж', settlement: 'Лозен' }, { field: 'settlement', code: 'import.errors.settlementAmbiguous', detail: 'Столична, Любимец, Стара Загора, Гурково' }],
    ['an unknown settlement', { type: 'гараж', settlement: 'Атлантида' }, { field: 'settlement', code: 'import.errors.settlementNotFound' }],
    ['a bad sale price', { type: 'гараж', settlement: 'София', sale: 'по договаряне' }, { field: 'sale_price', code: 'import.errors.invalidPrice' }],
    ['a zero rent price', { type: 'гараж', settlement: 'София', rent: '0' }, { field: 'rent_price', code: 'import.errors.invalidPrice' }],
    ['an unknown broker', { type: 'гараж', settlement: 'София', broker: 'nobody@beta.bg' }, { field: 'assigned_to', code: 'import.errors.unknownAssignee' }],
    ['an unknown listing status with a price', { type: 'гараж', settlement: 'София', sale: '1000', status: 'може би' }, { field: 'listing_status', code: 'import.errors.invalidListingStatus' }],
    ['a bad listing date', { type: 'гараж', settlement: 'София', sale: '1000', listed: 'вчера' }, { field: 'listed_at', code: 'import.errors.invalidDate' }],
    ['an apartment with no rooms', { type: 'апартамент', settlement: 'София' }, { field: 'rooms', code: 'validation.rooms_required' }],
  ])('marks %s invalid', (_label, cells, error) => {
    const result = validate(cells);
    expect(result.status).toBe('invalid');
    expect(result.errors).toContainEqual(error);
  });

  it('reports a settlement error instead of the form\'s "settlement required"', () => {
    const result = validate({ type: 'гараж', settlement: 'Атлантида' });
    expect(result.errors.map((e) => e.code)).not.toContain('validation.settlement_required');
  });

  it('never matches an area of another settlement', () => {
    const result = validate({ type: 'гараж', settlement: 'Лозен', municipality: 'Столична', area: 'Лозенец' });
    expect(result.normalized).toMatchObject({ property: { area_id: null }, new_area: { settlement_id: '00000000-0000-4000-8000-000000000001' } });
  });
});

describe('classifyPropertyRow (Task 4)', () => {
  const OWNER_A = '33333333-3333-4333-8333-000000000001';
  const OWNER_B = '33333333-3333-4333-8333-000000000002';

  const fullMapping = { ...mapping, owner_name: 'owner', owner_phone: 'phone', owner_email: 'email' };
  const lookups = (over: Partial<PropertyLookups> = {}): PropertyLookups => ({
    refs: new Map([['A-1', 'existing-by-ref']]),
    addresses: new Map(),
    phones: new Map([['+359888123456', OWNER_A]]),
    emails: new Map([['owner@b.bg', OWNER_B]]),
    contactNames: new Map([[OWNER_A, 'Иван Петров'], [OWNER_B, 'Мария Б']]),
    ...over,
  });
  const fresh = (): ClassifyState => ({ refs: new Set(), addresses: new Set() });

  const classify = (rowNumber: number, cells: Record<string, string>, l = lookups(), state = fresh()) => {
    const candidate = mapRowToPropertyCandidate({ type: 'гараж', settlement: 'София', ...cells }, fullMapping);
    const validated = validatePropertyRow(candidate, context());
    return classifyPropertyRow(rowNumber, candidate, validated, l, state);
  };

  it('skips a row whose external_ref an existing property has', () => {
    expect(classify(1, { ref: 'A-1' })).toMatchObject({ status: 'skipped', match_reason: 'external_ref', matched_entity_id: 'existing-by-ref' });
  });

  it('skips a row whose external_ref an earlier row has', () => {
    const state = fresh();
    expect(classify(1, { ref: 'NEW-1' }, lookups(), state).status).toBe('valid');
    expect(classify(2, { ref: 'NEW-1' }, lookups(), state)).toMatchObject({ status: 'skipped', match_reason: 'external_ref', matched_entity_id: null });
  });

  it('marks an address an existing property has a duplicate', () => {
    const l = lookups({ addresses: new Map([[3, { key: 'яворов12', property_id: 'existing-by-address' }]]) });
    expect(classify(3, { address: 'ул Яворов 12' }, l)).toMatchObject({ status: 'duplicate', match_reason: 'address', matched_entity_id: 'existing-by-address' });
  });

  it('marks the second row with the same settlement and address in_file', () => {
    const l = lookups({ addresses: new Map([[1, { key: 'яворов12', property_id: null }], [2, { key: 'яворов12', property_id: null }]]) });
    const state = fresh();
    expect(classify(1, { address: 'ул. Яворов 12' }, l, state).status).toBe('valid');
    expect(classify(2, { address: 'ул Яворов 12' }, l, state)).toMatchObject({ status: 'duplicate', match_reason: 'in_file' });
  });

  it('never calls rows in different settlements or without an address in-file duplicates', () => {
    const l = lookups({ addresses: new Map([[1, { key: 'яворов12', property_id: null }], [2, { key: 'яворов12', property_id: null }]]) });
    const state = fresh();
    classify(1, { address: 'ул. Яворов 12' }, l, state);
    expect(classify(2, { settlement: 'Лозен', municipality: 'Столична', address: 'ул. Яворов 12' }, l, state).status).toBe('valid');
    expect(classify(3, {}, l, state).status).toBe('valid');
    expect(classify(4, {}, l, state).status).toBe('valid');
  });

  it('links an owner matched by phone, then by email', () => {
    expect(classify(1, { owner: 'Иван', phone: '0888 123 456' }).normalized).toMatchObject({
      owner_contact_id: OWNER_A, owner_display_name: 'Иван Петров', new_owner: null,
    });
    expect(classify(1, { phone: '0899 000 000', email: 'OWNER@b.bg', owner: 'Мария' }).normalized).toMatchObject({ owner_contact_id: OWNER_B });
  });

  it('creates a new owner, split into first and last name, when nothing matches', () => {
    expect(classify(1, { owner: 'Петър Иванов Петров', phone: '0899 000 000', email: 'P@x.bg' }).normalized).toMatchObject({
      owner_contact_id: null,
      new_owner: { first_name: 'Петър', last_name: 'Иванов Петров', phone: '+359899000000', email: 'p@x.bg' },
    });
  });

  it('never matches a name-only owner', () => {
    expect(classify(1, { owner: 'Иван Петров' }).normalized).toMatchObject({
      owner_contact_id: null, new_owner: { first_name: 'Иван', last_name: 'Петров', phone: null, email: null },
    });
  });

  it('has no owner when the row has none', () => {
    expect(classify(1, {}).normalized).toMatchObject({ owner_contact_id: null, new_owner: null });
  });

  it('makes an owner phone that does not parse invalid', () => {
    expect(classify(1, { owner: 'Иван', phone: '12' })).toMatchObject({
      status: 'invalid', errors: [{ field: 'owner_phone', code: 'import.errors.ownerPhoneInvalid' }],
    });
  });

  it('makes a new owner with no name invalid, rather than inventing one', () => {
    expect(classify(1, { phone: '0899 000 000' })).toMatchObject({
      status: 'invalid', errors: [{ field: 'owner_name', code: 'import.errors.ownerNameRequired' }],
    });
    expect(classify(1, { phone: '0888 123 456' }).status).toBe('valid');
  });

  it('adds the owner phone error to a row that is already invalid', () => {
    const result = classify(1, { settlement: 'Атлантида', phone: 'xx' });
    expect(result.errors.map((e) => e.code)).toEqual(['import.errors.settlementNotFound', 'import.errors.ownerPhoneInvalid']);
  });
});

describe('resolveDefaultAssignee', () => {
  const members = [{ user_id: '22222222-2222-4222-8222-000000000001' }];

  it('takes the job default when it is an active member, else the importer', () => {
    expect(resolveDefaultAssignee('22222222-2222-4222-8222-000000000001', 'importer', members)).toBe('22222222-2222-4222-8222-000000000001');
    expect(resolveDefaultAssignee(null, 'importer', members)).toBe('importer');
    expect(resolveDefaultAssignee(undefined, 'importer', members)).toBe('importer');
  });

  it('refuses a job default who is not an active member of the agency', () => {
    expect(() => resolveDefaultAssignee('22222222-2222-4222-8222-000000000099', 'importer', members)).toThrow(
      expect.objectContaining({ code: 'import.errors.unknownDefaultAssignee' }),
    );
  });
});
