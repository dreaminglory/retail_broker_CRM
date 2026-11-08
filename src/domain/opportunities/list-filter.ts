/**
 * The opportunity list's options as a smart list filter (AD-062): the list page reads through
 * smart_list_opportunities with it, and a list saved from the page stores the same filter.
 * Pure, so the URL mapping in smart-lists/url-filter.ts can use it without the service.
 */

import type { OpportunityListFilter } from '../smart-lists/validation';
import type { OpportunityListOptions } from './types';
import { opportunityStatusSchema } from './validation';

const ALL_STATUSES = opportunityStatusSchema.options;

/** The list page's options as a smart list filter (newest first, as the list always was). */
export function toListFilter(opts: OpportunityListOptions): OpportunityListFilter {
  const filter: OpportunityListFilter = {
    status: opts.status === 'all' ? [...ALL_STATUSES] : [opts.status ?? 'active'],
  };
  if (opts.type && opts.type !== 'all') filter.type = [opts.type];
  if (opts.stageId && opts.stageId !== 'all') filter.stage_id = [opts.stageId];
  if (opts.temperature) filter.temperature = [opts.temperature];
  if (opts.assignedTo) filter.assigned_to = opts.assignedTo;
  if (opts.sourceId) filter.source_id = [opts.sourceId];
  if (opts.nextAction) filter.next_action = opts.nextAction;
  if (opts.noTouchDays) filter.no_touch_days = opts.noTouchDays;
  if (opts.hasNewMatches) filter.has_new_matches = true;
  if (opts.search?.trim()) filter.search = opts.search.trim();
  return filter;
}
