/**
 * The one-line summary of a requirement ("Апартамент или мезонет, 2–3 стаи, Лозенец или Изток,
 * до 200 000 €") and the formatters the opportunity page and the timeline share. Pure: the
 * caller passes the translators and formatter of its locale, on the server or the client.
 */
import type { createFormatter } from 'next-intl';
import type { OpportunityType } from '@/domain/opportunities/types';
import type { MustCriterion, Requirement, RequirementLocation, RequirementRow } from './types';

/** next-intl's translator for a namespace, on the server or the client. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

/** `useFormatter()` on the client, `createFormatter()` on the server. */
type Format = ReturnType<typeof createFormatter>;

/** `t` for the `requirements` namespace, `enums` for `Enums`. */
export type SummaryTools = { t: Translate; enums: Translate; format: Format };

export type SummaryPart = { criterion: MustCriterion; text: string; must: boolean };

/** More locations than this show as the first ones and "още N". */
const MAX_LOCATIONS = 3;

/** "2–3", "от 2", "до 3", "2"; null when neither bound is set. */
export function formatRange(t: Translate, min: string | null, max: string | null): string | null {
  if (min !== null && max !== null) return min === max ? min : t('range.between', { min, max });
  if (min !== null) return t('range.from', { min });
  if (max !== null) return t('range.to', { max });
  return null;
}

function bounds(min: number | null, max: number | null, show: (value: number) => string) {
  return [min === null ? null : show(min), max === null ? null : show(max)] as const;
}

/** "150 000 €–200 000 €", or "до 800 € / месец" on a tenant deal (the budget is the rent). */
export function formatBudget(
  value: Pick<RequirementRow, 'budget_min' | 'budget_max'>,
  opportunityType: OpportunityType,
  { t, format }: SummaryTools,
): string | null {
  const euro = (amount: number) => format.number(amount, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const range = formatRange(t, ...bounds(value.budget_min, value.budget_max, euro));
  if (range === null) return null;
  return opportunityType === 'tenant' ? t('perMonth', { value: range }) : range;
}

export function formatRooms(value: Pick<RequirementRow, 'rooms_min' | 'rooms_max'>, { t, format }: SummaryTools): string | null {
  if (value.rooms_min !== null && value.rooms_min === value.rooms_max) return t('roomsExact', { count: value.rooms_min });
  const range = formatRange(t, ...bounds(value.rooms_min, value.rooms_max, (rooms) => format.number(rooms)));
  return range === null ? null : t('rooms', { value: range });
}

export function formatArea(value: Pick<RequirementRow, 'area_m2_min' | 'area_m2_max'>, { t, format }: SummaryTools): string | null {
  const range = formatRange(t, ...bounds(value.area_m2_min, value.area_m2_max, (m2) => format.number(m2)));
  return range === null ? null : t('m2', { value: range });
}

/** "от 2, не последен"; the ground floor (партер) is floor 1. */
export function formatFloor(
  value: Pick<RequirementRow, 'floor_min' | 'floor_max' | 'not_top_floor'>,
  { t, format }: SummaryTools,
): string | null {
  const parts = [
    formatRange(t, ...bounds(value.floor_min, value.floor_max, (floor) => format.number(floor))),
    value.not_top_floor ? t('notTopFloor') : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(', ');
}

/** "Апартамент или мезонет": the first name as the enum has it, the rest in lower case. */
export function formatTypes(value: Pick<RequirementRow, 'property_types'>, { enums, format }: SummaryTools): string | null {
  if (value.property_types.length === 0) return null;
  const names = value.property_types.map((type, index) => {
    const name = enums(`propertyType.${type}`);
    return index === 0 ? name : name.toLocaleLowerCase();
  });
  return format.list(names, { type: 'disjunction' });
}

/**
 * An area, or the settlement for a whole settlement. The settlement goes next to an area only
 * when the requirement spans several settlements.
 */
export function locationLabel(location: RequirementLocation, locations: RequirementLocation[], { t }: SummaryTools): string {
  if (!location.area_name) return location.settlement_name;
  const settlements = new Set(locations.map((item) => item.settlement_id));
  return settlements.size > 1
    ? t('areaInSettlement', { area: location.area_name, settlement: location.settlement_name })
    : location.area_name;
}

/** "Лозенец или Изток"; past three, "Лозенец, Изток или още 3". */
export function formatLocations(locations: RequirementLocation[], tools: SummaryTools): string | null {
  if (locations.length === 0) return null;
  const labels = locations.map((location) => locationLabel(location, locations, tools));
  const shown =
    labels.length > MAX_LOCATIONS
      ? [...labels.slice(0, MAX_LOCATIONS - 1), tools.t('moreLocations', { count: labels.length - (MAX_LOCATIONS - 1) })]
      : labels;
  return tools.format.list(shown, { type: 'disjunction' });
}

/**
 * The matchable criteria that are set, in reading order: type, rooms, area, where, budget.
 * Floor and construction are in the full criteria only; financing and wishes are never
 * matched, so they are never in the summary.
 */
export function summarizeRequirement(value: Requirement, opportunityType: OpportunityType, tools: SummaryTools): SummaryPart[] {
  const parts: [MustCriterion, string | null, boolean][] = [
    ['type', formatTypes(value, tools), value.type_must],
    ['rooms', formatRooms(value, tools), value.rooms_must],
    ['area_m2', formatArea(value, tools), value.area_m2_must],
    ['location', formatLocations(value.locations, tools), value.location_must],
    ['budget', formatBudget(value, opportunityType, tools), value.budget_must],
  ];
  // The line starts with a capital even when its first part is "до 800 €".
  return parts.flatMap(([criterion, text, must]) => (text === null ? [] : [{ criterion, text, must }])).map((part, index) =>
    index === 0 ? { ...part, text: part.text.charAt(0).toLocaleUpperCase() + part.text.slice(1) } : part,
  );
}

export function summaryText(parts: SummaryPart[]): string {
  return parts.map((part) => part.text).join(', ');
}
