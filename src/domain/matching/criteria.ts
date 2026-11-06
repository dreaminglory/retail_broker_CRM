import type { OpportunityType } from '@/domain/opportunities/types';
import type { MatchCriterion, MatchResult } from './types';

export type MatchChip = { key: string; result: Exclude<MatchResult, 'n/a'>; must: boolean };

/**
 * The chips of one match: a label key, the result and the must-have mark per criterion. It only
 * maps what `match_evaluate` returned and never recomputes a result (AD-060). `n/a` criteria are
 * dropped; the budget reads as rent on a tenant deal.
 */
export function toChips(criteria: MatchCriterion[], opportunityType: OpportunityType): MatchChip[] {
  return criteria.flatMap(({ criterion, result, must }) => {
    if (result === 'n/a') return [];
    const name = criterion === 'budget' && opportunityType === 'tenant' ? 'budgetRent' : criterion;
    return [{ key: `matching.criteria.${name}`, result, must }];
  });
}
