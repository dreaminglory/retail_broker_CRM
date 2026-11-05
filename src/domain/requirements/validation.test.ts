import { describe, expect, it } from 'vitest';
import { applyDefaultMust, criterionIsSet, requirementEditable, requirementInputSchema, toRpcArgs } from './validation';

const SOFIA = '11111111-0000-4000-8000-000000000001';
const PLOVDIV = '11111111-0000-4000-8000-000000000002';
const LOZENETS = '22222222-0000-4000-8000-000000000001';
const IZTOK = '22222222-0000-4000-8000-000000000002';

function issues(input: unknown) {
  const result = requirementInputSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => [issue.path.join('.'), issue.message]);
}

describe('requirementInputSchema', () => {
  it('parses AC-1 from form strings', () => {
    const result = requirementInputSchema.parse({
      budget_min: '150000',
      budget_max: '200 000',
      property_types: ['apartment', 'maisonette'],
      rooms_min: '2',
      rooms_max: '3',
      area_m2_min: '',
      not_top_floor: true,
      construction: ['brick'],
      financing: 'mortgage',
      wishes: '  needs parking  ',
      budget_must: true,
      location_must: true,
      type_must: true,
      locations: [
        { settlement_id: SOFIA, area_id: LOZENETS },
        { settlement_id: SOFIA, area_id: IZTOK },
      ],
    });

    expect(result).toMatchObject({
      budget_min: 150_000,
      budget_max: 200_000,
      rooms_min: 2,
      rooms_max: 3,
      area_m2_min: null,
      area_m2_max: null,
      floor_min: null,
      not_top_floor: true,
      wishes: 'needs parking',
      rooms_must: false,
    });
  });

  it('treats empty lists, a missing financing and missing flags as empty', () => {
    expect(requirementInputSchema.parse({ budget_max: 800 })).toMatchObject({
      property_types: [],
      construction: [],
      locations: [],
      financing: 'unknown',
      wishes: null,
      not_top_floor: false,
      budget_must: false,
    });
  });

  it('refuses a requirement with no criterion (rule 2, AC-4)', () => {
    expect(issues({ financing: 'cash', wishes: 'something', not_top_floor: true })).toEqual([
      ['', 'validation.requirement_criterion_required'],
    ]);
  });

  it.each(['budget', 'rooms', 'area_m2', 'floor'] as const)('refuses %s_min above %s_max (rule 3, AC-4)', (criterion) => {
    const input = { budget_max: 1, [`${criterion}_min`]: 5, [`${criterion}_max`]: 3 };

    expect(issues(input)).toContainEqual([`${criterion}_max`, 'validation.min_above_max']);
  });

  it.each(['budget', 'rooms', 'area_m2', 'floor'] as const)('accepts %s_min equal to %s_max ("exactly 3 rooms")', (criterion) => {
    expect(issues({ budget_max: 3, [`${criterion}_min`]: 3, [`${criterion}_max`]: 3 })).toEqual([]);
  });

  it('puts types and construction in the list order, whatever order they were picked in', () => {
    const result = requirementInputSchema.parse({
      property_types: ['maisonette', 'studio', 'apartment'],
      construction: ['panel', 'brick'],
    });

    expect(result.property_types).toEqual(['apartment', 'studio', 'maisonette']);
    expect(result.construction).toEqual(['brick', 'panel']);
  });

  it.each([
    [{ rooms_min: 0 }, 'rooms_min', 'validation.rooms_range'],
    [{ rooms_max: 10 }, 'rooms_max', 'validation.rooms_range'],
    [{ budget_min: -1 }, 'budget_min', 'validation.positive_number'],
    [{ area_m2_max: 0 }, 'area_m2_max', 'validation.positive_number'],
    [{ budget_max: 1, floor_min: -6 }, 'floor_min', 'validation.floor_range'],
    [{ budget_max: 1, wishes: 'x'.repeat(2001) }, 'wishes', 'validation.text_too_long'],
  ])('refuses %o out of range (rule 3)', (input, path, message) => {
    expect(issues(input)).toContainEqual([path, message]);
  });

  it.each([
    [{ budget_max: 1, location_must: true }, 'location_must'],
    [{ budget_max: 1, type_must: true }, 'type_must'],
    [{ property_types: ['apartment'], budget_must: true }, 'budget_must'],
    [{ budget_max: 1, rooms_must: true }, 'rooms_must'],
    [{ budget_max: 1, area_m2_must: true }, 'area_m2_must'],
    [{ budget_max: 1, floor_must: true }, 'floor_must'],
    [{ budget_max: 1, construction_must: true }, 'construction_must'],
  ])('refuses a must-have flag without its criterion: %o (rule 4, AC-5)', (input, path) => {
    expect(issues(input)).toEqual([[path, 'validation.must_without_criterion']]);
  });

  it('lets "not the top floor" carry the floor must-have', () => {
    expect(issues({ budget_max: 1, not_top_floor: true, floor_must: true })).toEqual([]);
  });

  it('refuses a whole settlement together with one of its areas', () => {
    const input = { locations: [{ settlement_id: SOFIA }, { settlement_id: SOFIA, area_id: LOZENETS }] };

    expect(issues(input)).toEqual([['locations', 'validation.location_covered']]);
  });

  it('keeps a whole settlement next to an area of another one', () => {
    const input = { locations: [{ settlement_id: PLOVDIV, area_id: null }, { settlement_id: SOFIA, area_id: LOZENETS }] };

    expect(issues(input)).toEqual([]);
  });

  it('drops a location listed twice', () => {
    const result = requirementInputSchema.parse({
      locations: [
        { settlement_id: SOFIA, area_id: LOZENETS },
        { settlement_id: SOFIA, area_id: LOZENETS },
      ],
    });

    expect(result.locations).toEqual([{ settlement_id: SOFIA, area_id: LOZENETS }]);
  });

  it('refuses an unknown property type or construction', () => {
    expect(issues({ property_types: ['castle'] })).toHaveLength(1);
    expect(issues({ budget_max: 1, construction: ['straw'] })).toHaveLength(1);
  });
});

describe('criterionIsSet', () => {
  it.each([
    ['budget', { budget_min: 1 }, true],
    ['budget', {}, false],
    ['location', { locations: [{ settlement_id: SOFIA, area_id: null }] }, true],
    ['type', { property_types: [] }, false],
    ['floor', { not_top_floor: true }, true],
    ['construction', { construction: ['panel'] }, true],
  ] as const)('%s in %o → %s', (criterion, values, expected) => {
    expect(criterionIsSet(values, criterion)).toBe(expected);
  });
});

describe('applyDefaultMust', () => {
  it('turns budget, location and type on when they are first filled (rule 4)', () => {
    const before = { budget_must: false, location_must: false, type_must: false, rooms_must: false };
    const values = { budget_max: 1, property_types: ['apartment'], rooms_min: 2, locations: [{ settlement_id: SOFIA }] };

    expect(applyDefaultMust({}, values, before, new Set())).toMatchObject({
      budget_must: true,
      location_must: true,
      type_must: true,
      rooms_must: false,
    });
  });

  it('leaves a flag the broker switched alone', () => {
    const flags = { budget_must: false };

    expect(applyDefaultMust({}, { budget_max: 1 }, flags, new Set(['budget'] as const))).toMatchObject({ budget_must: false });
  });

  it('turns a flag off when its criterion is emptied', () => {
    expect(applyDefaultMust({ budget_max: 1 }, {}, { budget_must: true }, new Set(['budget'] as const))).toMatchObject({
      budget_must: false,
    });
  });

  it("doesn't turn a default on again while the criterion stays filled", () => {
    expect(applyDefaultMust({ budget_max: 1 }, { budget_max: 2 }, { budget_must: false }, new Set())).toMatchObject({
      budget_must: false,
    });
  });
});

describe('toRpcArgs', () => {
  it('splits the locations from the fields and fills a missing area with null', () => {
    const input = requirementInputSchema.parse({ budget_max: 800, locations: [{ settlement_id: SOFIA }] });
    const { fields, locations } = toRpcArgs(input);

    expect(locations).toEqual([{ settlement_id: SOFIA, area_id: null }]);
    expect(fields).not.toHaveProperty('locations');
    expect(fields).toMatchObject({ budget_max: 800, financing: 'unknown' });
  });
});

describe('requirementEditable', () => {
  it.each([
    ['active', true],
    ['nurture', true],
    ['won', false],
    ['lost', false],
    ['archived', false],
  ] as const)('%s → %s (rule 7)', (status, expected) => {
    expect(requirementEditable(status)).toBe(expected);
  });
});
