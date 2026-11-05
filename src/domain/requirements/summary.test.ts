import { createFormatter, createTranslator, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../messages/bg.json';
import en from '../../../messages/en.json';
import type { OpportunityType } from '@/domain/opportunities/types';
import type { Requirement, RequirementLocation } from './types';
import { formatFloor, summarizeRequirement, summaryText, type SummaryTools } from './summary';

/** Untyped, so the translators take any key like the app's do. */
const MESSAGES: Record<'bg' | 'en', AbstractIntlMessages> = { bg, en };

function tools(locale: 'bg' | 'en'): SummaryTools {
  const translator = (namespace: string) =>
    createTranslator({ locale, messages: MESSAGES[locale], namespace }) as unknown as SummaryTools['t'];
  return {
    t: translator('requirements'),
    enums: translator('Enums'),
    format: createFormatter({ locale, timeZone: 'Europe/Sofia' }),
  };
}

/** Intl puts no-break spaces in "150 000 €"; the assertions read plain spaces. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

const sofia = (area: string | null, settlement = { bg: 'София', en: 'Sofia' }) => ({ area, settlement });

function location(
  locale: 'bg' | 'en',
  { area, settlement }: ReturnType<typeof sofia>,
  overrides: Partial<RequirementLocation> = {},
): RequirementLocation {
  return {
    settlement_id: `s-${settlement.en}`,
    settlement_name: settlement[locale],
    area_id: area ? `a-${area}` : null,
    area_name: area,
    area_active: area ? true : null,
    ...overrides,
  };
}

function requirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: 'r-1',
    agency_id: 'agency-1',
    opportunity_id: 'opp-1',
    budget_min: null,
    budget_max: null,
    property_types: [],
    rooms_min: null,
    rooms_max: null,
    area_m2_min: null,
    area_m2_max: null,
    floor_min: null,
    floor_max: null,
    not_top_floor: false,
    construction: [],
    financing: 'unknown',
    wishes: null,
    budget_must: false,
    location_must: false,
    type_must: false,
    rooms_must: false,
    area_m2_must: false,
    floor_must: false,
    construction_must: false,
    location_keys: [],
    created_by: null,
    created_at: '2026-11-05T09:00:00Z',
    updated_at: '2026-11-05T09:00:00Z',
    locations: [],
    ...overrides,
  };
}

function line(locale: 'bg' | 'en', value: Requirement, type: OpportunityType = 'buyer') {
  return plain(summaryText(summarizeRequirement(value, type, tools(locale))));
}

describe('summarizeRequirement', () => {
  const ac1 = (locale: 'bg' | 'en') =>
    requirement({
      property_types: ['apartment', 'maisonette'],
      rooms_min: 2,
      rooms_max: 3,
      budget_min: 150_000,
      budget_max: 200_000,
      locations: [location(locale, sofia('Лозенец')), location(locale, sofia('Изток'))],
      budget_must: true,
      location_must: true,
      type_must: true,
    });

  it('reads AC-1 as type, rooms, areas and the price range (BG)', () => {
    expect(line('bg', ac1('bg'))).toBe('Апартамент или мезонет, 2–3 стаи, Лозенец или Изток, 150 000 €–200 000 €');
  });

  it('reads AC-1 as type, rooms, areas and the price range (EN)', () => {
    expect(line('en', ac1('en'))).toBe('Apartment or maisonette, 2–3 rooms, Лозенец or Изток, €150,000–€200,000');
  });

  it('marks budget, location and type as must-haves and the rest not', () => {
    const parts = summarizeRequirement(ac1('bg'), 'buyer', tools('bg'));

    expect(parts.map(({ criterion, must }) => [criterion, must])).toEqual([
      ['type', true],
      ['rooms', false],
      ['location', true],
      ['budget', true],
    ]);
  });

  it.each([
    ['bg', 'От 2 стаи, до 200 000 €'],
    ['en', 'From 2 rooms, up to €200,000'],
  ] as const)('reads open bounds (%s)', (locale, expected) => {
    expect(line(locale, requirement({ budget_max: 200_000, rooms_min: 2 }))).toBe(expected);
  });

  it.each([
    ['bg', 'От 150 000 €'],
    ['en', 'From €150,000'],
  ] as const)('reads a budget floor only (%s)', (locale, expected) => {
    expect(line(locale, requirement({ budget_min: 150_000 }))).toBe(expected);
  });

  it.each([
    ['bg', '2 стаи, 200 000 €'],
    ['en', '2 rooms, €200,000'],
  ] as const)('reads an equal min and max as one value (%s)', (locale, expected) => {
    expect(line(locale, requirement({ rooms_min: 2, rooms_max: 2, budget_min: 200_000, budget_max: 200_000 }))).toBe(expected);
  });

  it.each([
    ['bg', '1 стая'],
    ['en', '1 room'],
  ] as const)('uses the singular for one room (%s)', (locale, expected) => {
    expect(line(locale, requirement({ rooms_min: 1, rooms_max: 1 }))).toBe(expected);
  });

  it.each([
    ['bg', '60–90 м²'],
    ['en', '60–90 m²'],
  ] as const)('reads the area range (%s)', (locale, expected) => {
    expect(line(locale, requirement({ area_m2_min: 60, area_m2_max: 90 }))).toBe(expected);
  });

  it.each([
    ['bg', 'buyer', 'До 200 000 €'],
    ['bg', 'tenant', 'До 800 € / месец'],
    ['en', 'buyer', 'Up to €200,000'],
    ['en', 'tenant', 'Up to €800 / month'],
  ] as const)('reads the budget as a price or a monthly rent (%s %s)', (locale, type, expected) => {
    const value = requirement({ budget_max: type === 'tenant' ? 800 : 200_000 });

    expect(line(locale, value, type)).toBe(expected);
  });

  it.each([
    ['bg', 'Пловдив'],
    ['en', 'Plovdiv'],
  ] as const)('names a whole settlement (%s)', (locale, expected) => {
    const plovdiv = { area: null, settlement: { bg: 'Пловдив', en: 'Plovdiv' } };

    expect(line(locale, requirement({ locations: [location(locale, plovdiv)] }))).toBe(expected);
  });

  it.each([
    ['bg', 'Лозенец (София) или Пловдив'],
    ['en', 'Лозенец (Sofia) or Plovdiv'],
  ] as const)('adds the settlement to an area when there are several settlements (%s)', (locale, expected) => {
    const plovdiv = { area: null, settlement: { bg: 'Пловдив', en: 'Plovdiv' } };

    expect(line(locale, requirement({ locations: [location(locale, sofia('Лозенец')), location(locale, plovdiv)] }))).toBe(expected);
  });

  it.each([
    ['bg', 'Лозенец, Изток или още 3'],
    ['en', 'Лозенец, Изток, or 3 more'],
  ] as const)('shortens more than three locations (%s)', (locale, expected) => {
    const locations = ['Лозенец', 'Изток', 'Младост 1', 'Младост 2', 'Дианабад'].map((area) => location(locale, sofia(area)));

    expect(line(locale, requirement({ locations }))).toBe(expected);
  });

  it('leaves out floor, construction, financing and wishes', () => {
    const value = requirement({
      rooms_min: 2,
      floor_min: 2,
      not_top_floor: true,
      construction: ['brick'],
      financing: 'mortgage',
      wishes: 'паркинг',
    });

    expect(line('bg', value)).toBe('От 2 стаи');
  });
});

describe('formatFloor', () => {
  it.each([
    ['bg', { floor_min: 2, floor_max: null, not_top_floor: true }, 'от 2, не последен'],
    ['en', { floor_min: 2, floor_max: null, not_top_floor: true }, 'from 2, not the top floor'],
    ['bg', { floor_min: 2, floor_max: 5, not_top_floor: false }, '2–5'],
    ['en', { floor_min: null, floor_max: null, not_top_floor: true }, 'not the top floor'],
    ['en', { floor_min: null, floor_max: null, not_top_floor: false }, null],
  ] as const)('%s %o → %s', (locale, value, expected) => {
    expect(formatFloor(value, tools(locale))).toBe(expected);
  });
});
