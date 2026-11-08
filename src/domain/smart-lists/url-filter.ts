/**
 * The opportunity list's URL filters as a saved list filter, and back (spec: smart-lists rule 3,
 * "Save as list" and "Edit filters"). Saving goes through `toListFilter`, the same mapping the
 * list page reads with, so a saved list shows exactly the rows the page showed.
 */

import { z } from 'zod';
import { toListFilter } from '../opportunities/service';
import {
  opportunityStatusSchema,
  opportunityTypeSchema,
  parseOpportunityListFilters,
} from '../opportunities/validation';
import type { OpportunityListFilter } from './validation';

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
