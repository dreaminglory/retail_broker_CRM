/**
 * The entity lists' URL filters as a saved list filter, and back (AD-063; spec: smart-lists rule 3,
 * "Save as list" and "Edit filters"). Saving goes through `toListFilter`, the same mapping the
 * list page reads with, so a saved list shows exactly the rows the page showed.
 */

import { z } from 'zod';
import { toListFilter } from '../opportunities/list-filter';
import {
  opportunityStatusSchema,
  opportunityTypeSchema,
  parseOpportunityListFilters,
} from '../opportunities/validation';
import type { ListFilter, SmartListEntity } from './types';
import { inquiryStatusSchema, type InquiryListFilter, type OpportunityListFilter } from './validation';

/** The opportunity list's search params, as the page reads them. */
export type OpportunityListParams = {
  search?: string;
  status?: string;
  stage?: string;
  type?: string;
  broker?: string;
  temperature?: string;
  source?: string;
  next?: string;
  untouched?: string;
  matches?: string;
  [key: string]: string | undefined;
};

const ALL_STATUSES = opportunityStatusSchema.options;
const uuid = z.string().uuid();

/** The URL's filters as a filter; a bad value is no filter, as on the list page. */
export function opportunityFilterFromParams(params: OpportunityListParams): OpportunityListFilter {
  const status = opportunityStatusSchema.safeParse(params.status);
  const type = opportunityTypeSchema.safeParse(params.type);
  const stage = uuid.safeParse(params.stage);
  const { assignedTo, temperature, sourceId, nextAction, noTouchDays, hasNewMatches } =
    parseOpportunityListFilters(params);
  return {
    ...toListFilter({
      search: params.search,
      status: params.status === 'all' ? 'all' : status.success ? status.data : 'active',
      type: type.success ? type.data : undefined,
      stageId: stage.success ? stage.data : undefined,
      assignedTo,
      temperature,
      sourceId,
      nextAction,
      noTouchDays,
      hasNewMatches,
    }),
    sort: 'created_desc',
  };
}

/**
 * A saved filter as the list page's URL. What the page can't show (several values of a key,
 * `me`, `unassigned`) is left out; "Update list" then saves what the page shows.
 */
export function opportunityParamsFromFilter(filter: OpportunityListFilter): URLSearchParams {
  const params = new URLSearchParams();
  const one = <T>(values: T[] | undefined) => (values?.length === 1 ? values[0] : undefined);

  if (filter.search) params.set('search', filter.search);
  if (filter.status && ALL_STATUSES.every((s) => filter.status!.includes(s))) params.set('status', 'all');
  else {
    const status = one(filter.status);
    if (status && status !== 'active') params.set('status', status);
  }
  const type = one(filter.type);
  if (type) params.set('type', type);
  const stage = one(filter.stage_id);
  if (stage) params.set('stage', stage);
  if (filter.assigned_to && uuid.safeParse(filter.assigned_to).success) params.set('broker', filter.assigned_to);
  const temperature = one(filter.temperature);
  if (temperature) params.set('temperature', temperature);
  const source = one(filter.source_id);
  if (source) params.set('source', source);
  if (filter.next_action) params.set('next', filter.next_action);
  if (filter.no_touch_days) params.set('untouched', String(filter.no_touch_days));
  if (filter.has_new_matches) params.set('matches', 'new');
  return params;
}

// ── Inquiries ───────────────────────────────────────────────────────────────

const INQUIRY_STATUSES = inquiryStatusSchema.options;

/**
 * The inquiry list's URL filters (status and search, all it shows) as a filter, newest first as
 * the list is. Absent status is every inquiry, as on the list.
 */
export function inquiryFilterFromParams(params: { status?: string; search?: string; [key: string]: string | undefined }): InquiryListFilter {
  const filter: InquiryListFilter = {};
  const status = inquiryStatusSchema.safeParse(params.status);
  if (status.success) filter.status = [status.data];
  const search = params.search?.trim();
  if (search) filter.search = search;
  filter.sort = 'received_desc';
  return filter;
}

/** A saved inquiry filter as the inquiry list's URL; what the list can't show is left out. */
export function inquiryParamsFromFilter(filter: InquiryListFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.status?.length === 1) params.set('status', filter.status[0]);
  if (filter.search) params.set('search', filter.search);
  return params;
}

// ── Either entity ───────────────────────────────────────────────────────────

/** The entity list's URL filters as that entity's saved filter. */
export function listFilterFromParams(entity: SmartListEntity, params: Record<string, string | undefined>): ListFilter {
  return entity === 'opportunity'
    ? { entity, filter: opportunityFilterFromParams(params) }
    : { entity, filter: inquiryFilterFromParams(params) };
}

/** A saved filter as its entity list's URL ("Edit filters"). */
export function listParamsFromFilter(list: ListFilter): URLSearchParams {
  return list.entity === 'opportunity' ? opportunityParamsFromFilter(list.filter) : inquiryParamsFromFilter(list.filter);
}

/**
 * Whether the entity list can show this filter as it is. When it can't (`me`, `unassigned`,
 * several values of a key, another sort), "Update list" would replace those parts with what the
 * page shows, so the page warns first.
 */
export function shownExactly(list: ListFilter): boolean {
  const roundTrip = listFilterFromParams(list.entity, Object.fromEntries(listParamsFromFilter(list)));
  return canonical(list) === canonical(roundTrip);
}

/** The filter as the SQL reads it: defaults filled in, value arrays in one order. */
function canonical(list: ListFilter): string {
  const filter: Record<string, unknown> = { ...list.filter };
  if (list.entity === 'opportunity') {
    filter.status ??= ['active'];
    filter.sort ??= 'created_desc';
  } else {
    filter.sort ??= 'received_desc';
    // No status is every status on the inquiry list.
    if (Array.isArray(filter.status) && INQUIRY_STATUSES.every((s) => (filter.status as string[]).includes(s))) {
      delete filter.status;
    }
  }
  if (typeof filter.search === 'string') filter.search = filter.search.trim() || undefined;
  return JSON.stringify(
    Object.keys(filter)
      .filter((key) => filter[key] !== undefined)
      .sort()
      .map((key) => [key, Array.isArray(filter[key]) ? [...(filter[key] as string[])].sort() : filter[key]])
  );
}
