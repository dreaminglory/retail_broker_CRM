import { z } from 'zod';
import type { OpportunityStatus } from '@/domain/opportunities/types';
import { CONSTRUCTIONS, PROPERTY_TYPES } from '@/domain/properties/validation';
import type { Financing, MustCriterion } from './types';

/** Rule 7: editable while the deal is active or nurture; won, lost or archived is read-only. */
export function requirementEditable(status: OpportunityStatus): boolean {
  return status === 'active' || status === 'nurture';
}

export const FINANCINGS = ['cash', 'mortgage', 'mixed', 'unknown'] as const satisfies readonly Financing[];

export const MUST_CRITERIA = [
  'budget',
  'location',
  'type',
  'rooms',
  'area_m2',
  'floor',
  'construction',
] as const satisfies readonly MustCriterion[];

/** The must-haves the form turns on when the broker fills them (rule 4, assumption A1). */
export const DEFAULT_MUST: readonly MustCriterion[] = ['budget', 'location', 'type'];

export type MustFlags = Record<`${MustCriterion}_must`, boolean>;

const present = (value: unknown) =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

/** Form values or parsed input: is this criterion filled? `not_top_floor` counts for the floor. */
export function criterionIsSet(values: Readonly<Record<string, unknown>>, criterion: MustCriterion): boolean {
  const list = (key: string) => Array.isArray(values[key]) && (values[key] as unknown[]).length > 0;
  switch (criterion) {
    case 'location':
      return list('locations');
    case 'type':
      return list('property_types');
    case 'construction':
      return list('construction');
    case 'floor':
      return present(values.floor_min) || present(values.floor_max) || values.not_top_floor === true;
    default:
      return present(values[`${criterion}_min`]) || present(values[`${criterion}_max`]);
  }
}

/**
 * The must-have flags after a change in the form: a flag goes off when its criterion is
 * emptied, and budget, location and type go on when first filled unless the broker has
 * switched that flag themselves (rule 4).
 */
export function applyDefaultMust(
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
  flags: Partial<MustFlags>,
  switched: ReadonlySet<MustCriterion>,
): MustFlags {
  return Object.fromEntries(
    MUST_CRITERIA.map((criterion) => {
      const key = `${criterion}_must` as const;
      if (!criterionIsSet(next, criterion)) return [key, false];
      const firstFilled = !criterionIsSet(previous, criterion);
      if (firstFilled && DEFAULT_MUST.includes(criterion) && !switched.has(criterion)) return [key, true];
      return [key, flags[key] ?? false];
    }),
  ) as MustFlags;
}

/** "200 000", "1500,50" and 1500 all parse; blank is null. */
function optionalNumber(schema: z.ZodNumber) {
  return z.preprocess((value) => {
    if (!present(value)) return null;
    return typeof value === 'string' ? Number(value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')) : value;
  }, schema.nullable().default(null));
}

const number = () => z.number({ invalid_type_error: 'validation.number_invalid' });
const money = () => number().positive('validation.positive_number').max(999_999_999_999, 'validation.number_too_large');
const area = () => number().positive('validation.positive_number').max(99_999_999, 'validation.number_too_large');
const rooms = () => number().int('validation.rooms_range').min(1, 'validation.rooms_range').max(9, 'validation.rooms_range');
const floor = () => number().int('validation.floor_range').min(-5, 'validation.floor_range').max(200, 'validation.floor_range');

const flag = () => z.boolean().default(false);

const locationSchema = z.object({
  settlement_id: z.string().uuid('validation.settlement_required'),
  /** Missing or null = the whole settlement. */
  area_id: z.string().uuid().nullish().transform((value) => value ?? null),
});

const RANGES = ['budget', 'rooms', 'area_m2', 'floor'] as const;

/**
 * Rules 2–4, mirrored from the `CHECK`s on `requirements` (Q2–Q4). A save replaces the whole
 * requirement, so a missing field is empty. The database also checks that each area is in its
 * settlement and the agency's (Q5); Zod can't.
 */
export const requirementInputSchema = z
  .object({
    budget_min: optionalNumber(money()),
    budget_max: optionalNumber(money()),
    property_types: z.array(z.enum(PROPERTY_TYPES)).default([]),
    rooms_min: optionalNumber(rooms()),
    rooms_max: optionalNumber(rooms()),
    area_m2_min: optionalNumber(area()),
    area_m2_max: optionalNumber(area()),
    floor_min: optionalNumber(floor()),
    floor_max: optionalNumber(floor()),
    not_top_floor: flag(),
    construction: z.array(z.enum(CONSTRUCTIONS)).default([]),
    financing: z.enum(FINANCINGS).default('unknown'),
    wishes: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() || null : (value ?? null)),
      z.string().max(2000, 'validation.text_too_long').nullable(),
    ),
    budget_must: flag(),
    location_must: flag(),
    type_must: flag(),
    rooms_must: flag(),
    area_m2_must: flag(),
    floor_must: flag(),
    construction_must: flag(),
    locations: z.array(locationSchema).max(100, 'validation.failed').default([]),
  })
  .superRefine((value, ctx) => {
    const criteria = ['budget', 'location', 'type', 'rooms', 'area_m2'] as const;
    if (!criteria.some((criterion) => criterionIsSet(value, criterion))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: 'validation.requirement_criterion_required' });
    }
    for (const range of RANGES) {
      const min = value[`${range}_min`];
      const max = value[`${range}_max`];
      if (min !== null && max !== null && min > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`${range}_max`], message: 'validation.min_above_max' });
      }
    }
    for (const criterion of MUST_CRITERIA) {
      if (value[`${criterion}_must`] && !criterionIsSet(value, criterion)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`${criterion}_must`], message: 'validation.must_without_criterion' });
      }
    }
    // The whole settlement already covers its areas (unique per requirement, AD-059).
    const whole = new Set(value.locations.filter((location) => !location.area_id).map((location) => location.settlement_id));
    if (value.locations.some((location) => location.area_id && whole.has(location.settlement_id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locations'], message: 'validation.location_covered' });
    }
  })
  .transform((value) => {
    const seen = new Set<string>();
    const locations = value.locations.filter((location) => {
      const key = `${location.settlement_id}:${location.area_id ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      ...value,
      property_types: [...new Set(value.property_types)],
      construction: [...new Set(value.construction)],
      locations,
    };
  });

export type RequirementInput = z.input<typeof requirementInputSchema>;
export type RequirementValues = z.output<typeof requirementInputSchema>;

/** `save_requirement`'s arguments: the row's fields and its locations. */
export function toRpcArgs({ locations, ...fields }: RequirementValues) {
  return {
    fields,
    locations: locations.map(({ settlement_id, area_id }) => ({ settlement_id, area_id })),
  };
}
