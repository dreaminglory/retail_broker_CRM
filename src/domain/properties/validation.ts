import { z } from 'zod';
import { NONE_SELECT_VALUE, nullableUuid } from '@/lib/validation';
import type { Construction, PropertyType } from './types';

export const PROPERTY_TYPES = [
  'apartment',
  'studio',
  'maisonette',
  'house',
  'house_floor',
  'plot',
  'garage',
] as const satisfies readonly PropertyType[];

export const CONSTRUCTIONS = ['brick', 'panel', 'epk', 'timber', 'other'] as const satisfies readonly Construction[];

export type PropertyFields = {
  rooms: boolean;
  area_m2: boolean;
  plot_m2: boolean;
  floor: boolean;
  floors_total: boolean;
  building: boolean;
};

/**
 * Which attributes a type has. The form shows only these and the schema clears the rest, so a
 * value typed before the type changed is never saved. Rooms are only for apartments; "двустаен"
 * is derived from them (spec: properties).
 */
const FIELDS: Record<PropertyType, PropertyFields> = {
  apartment:   { rooms: true,  area_m2: true,  plot_m2: false, floor: true,  floors_total: true,  building: true },
  studio:      { rooms: false, area_m2: true,  plot_m2: false, floor: true,  floors_total: true,  building: true },
  maisonette:  { rooms: false, area_m2: true,  plot_m2: false, floor: true,  floors_total: true,  building: true },
  house:       { rooms: false, area_m2: true,  plot_m2: true,  floor: false, floors_total: true,  building: true },
  house_floor: { rooms: false, area_m2: true,  plot_m2: false, floor: true,  floors_total: true,  building: true },
  plot:        { rooms: false, area_m2: false, plot_m2: true,  floor: false, floors_total: false, building: false },
  garage:      { rooms: false, area_m2: true,  plot_m2: false, floor: true,  floors_total: false, building: false },
};

export function propertyFieldsFor(type: PropertyType): PropertyFields {
  return FIELDS[type];
}

const blankToNull = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '') ? null : value;

function optionalNumber(schema: z.ZodNumber) {
  return z.preprocess(
    (value) => {
      const blank = blankToNull(value);
      return typeof blank === 'string' ? Number(blank.replace(',', '.')) : blank;
    },
    schema.nullable(),
  );
}

function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.preprocess(blankToNull, z.string().max(max, 'validation.text_too_long').nullable()),
  );
}

const positiveArea = (max: number) =>
  z.number({ invalid_type_error: 'validation.number_invalid' }).positive('validation.positive_number').max(max, 'validation.number_too_large');

const propertyObject = z.object({
  type: z.enum(PROPERTY_TYPES, { errorMap: () => ({ message: 'validation.property_type_required' }) }),
  rooms: optionalNumber(z.number({ invalid_type_error: 'validation.number_invalid' }).int('validation.rooms_range').min(1, 'validation.rooms_range').max(9, 'validation.rooms_range')),
  area_m2: optionalNumber(positiveArea(99_999_999)),
  plot_m2: optionalNumber(positiveArea(9_999_999_999)),
  floor: optionalNumber(z.number({ invalid_type_error: 'validation.number_invalid' }).int('validation.floor_range').min(-5, 'validation.floor_range').max(200, 'validation.floor_range')),
  floors_total: optionalNumber(z.number({ invalid_type_error: 'validation.number_invalid' }).int('validation.floors_total_range').min(1, 'validation.floors_total_range').max(200, 'validation.floors_total_range')),
  construction: z.preprocess((value) => (value === NONE_SELECT_VALUE ? null : blankToNull(value)), z.enum(CONSTRUCTIONS, { errorMap: () => ({ message: 'validation.failed' }) }).nullable()),
  year_built: optionalNumber(z.number({ invalid_type_error: 'validation.number_invalid' }).int('validation.year_range').min(1800, 'validation.year_range').max(2100, 'validation.year_range')),
  // Checked in the refinement below, so a missing settlement doesn't hide the rule 3 errors.
  settlement_id: z.string().nullish(),
  area_id: nullableUuid(),
  address: optionalText(300),
  location_note: optionalText(500),
  description: optionalText(5000),
  assigned_to: nullableUuid(),
});

const UUID = z.string().uuid();

/**
 * Rule 3, mirrored from the `CHECK`s on `properties` (L3): an apartment needs 1–9 rooms, a plot
 * needs its plot area, and the floor is not above the building. Fields the type doesn't have
 * are ignored here and cleared in the output.
 */
export const propertyFormSchema = propertyObject
  .superRefine((value, ctx) => {
    const fields = FIELDS[value.type];
    if (!UUID.safeParse(value.settlement_id).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['settlement_id'], message: 'validation.settlement_required' });
    }
    if (value.type === 'apartment' && value.rooms === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rooms'], message: 'validation.rooms_required' });
    }
    if (value.type === 'plot' && value.plot_m2 === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['plot_m2'], message: 'validation.plot_m2_required' });
    }
    if (
      fields.floor &&
      fields.floors_total &&
      value.floor !== null &&
      value.floors_total !== null &&
      value.floor > value.floors_total
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['floor'], message: 'validation.floor_above_total' });
    }
  })
  .transform((value) => {
    const fields = FIELDS[value.type];
    return {
      ...value,
      settlement_id: value.settlement_id as string,
      rooms: fields.rooms ? value.rooms : null,
      area_m2: fields.area_m2 ? value.area_m2 : null,
      plot_m2: fields.plot_m2 ? value.plot_m2 : null,
      floor: fields.floor ? value.floor : null,
      floors_total: fields.floors_total ? value.floors_total : null,
      construction: fields.building ? value.construction : null,
      year_built: fields.building ? value.year_built : null,
    };
  });

export type PropertyFormInput = z.input<typeof propertyFormSchema>;
export type PropertyFormValues = z.output<typeof propertyFormSchema>;
