import { describe, expect, it } from 'vitest';
import { toChips } from './criteria';
import type { MatchCriterion } from './types';

// Copied from match_properties('Alpha Opp 1') on the seeded stack: the 83% Lozenets row.
const SEEDED: MatchCriterion[] = [
  { must: true, result: 'match', criterion: 'type' },
  { must: false, result: 'match', criterion: 'rooms' },
  { must: true, result: 'match', criterion: 'location' },
  { must: true, result: 'match', criterion: 'budget' },
  { must: false, result: 'match', criterion: 'floor' },
  { must: false, result: 'unknown', criterion: 'construction' },
];

describe('toChips', () => {
  it('keeps the order and the must-have marks', () => {
    expect(toChips(SEEDED, 'buyer')).toEqual([
      { key: 'matching.criteria.type', result: 'match', must: true },
      { key: 'matching.criteria.rooms', result: 'match', must: false },
      { key: 'matching.criteria.location', result: 'match', must: true },
      { key: 'matching.criteria.budget', result: 'match', must: true },
      { key: 'matching.criteria.floor', result: 'match', must: false },
      { key: 'matching.criteria.construction', result: 'unknown', must: false },
    ]);
  });

  it('passes every result through unchanged', () => {
    const results = ['match', 'close', 'miss', 'unknown'] as const;
    const chips = toChips(
      results.map((result) => ({ criterion: 'rooms' as const, result, must: false })),
      'buyer',
    );
    expect(chips.map((chip) => chip.result)).toEqual([...results]);
  });

  it('drops n/a criteria', () => {
    const chips = toChips(
      [
        { criterion: 'rooms', result: 'n/a', must: true },
        { criterion: 'area_m2', result: 'miss', must: false },
      ],
      'buyer',
    );
    expect(chips).toEqual([{ key: 'matching.criteria.area_m2', result: 'miss', must: false }]);
  });

  it('labels the budget as rent on a tenant deal and as price otherwise', () => {
    const budget: MatchCriterion[] = [{ criterion: 'budget', result: 'match', must: false }];
    expect(toChips(budget, 'tenant')[0].key).toBe('matching.criteria.budgetRent');
    expect(toChips(budget, 'buyer')[0].key).toBe('matching.criteria.budget');
  });

  it('returns nothing for no criteria', () => {
    expect(toChips([], 'buyer')).toEqual([]);
  });
});
