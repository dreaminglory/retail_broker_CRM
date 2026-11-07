import { describe, expect, it } from 'vitest';
import { toListFilter } from './service';

describe('toListFilter: the opportunity list options as a smart list filter', () => {
  it('defaults to the active deals, as the list always has', () => {
    expect(toListFilter({})).toEqual({ status: ['active'] });
  });

  it('reads "all" as no filter, and every status for status "all"', () => {
    expect(toListFilter({ status: 'all', type: 'all', stageId: 'all' })).toEqual({
      status: ['active', 'won', 'lost', 'nurture', 'archived'],
    });
  });

  it('maps the old filters to one-element arrays', () => {
    expect(
      toListFilter({ status: 'won', type: 'seller', stageId: 's1', temperature: 'hot', assignedTo: 'u1' })
    ).toEqual({ status: ['won'], type: ['seller'], stage_id: ['s1'], temperature: ['hot'], assigned_to: 'u1' });
  });

  it('maps the new filters', () => {
    expect(toListFilter({ sourceId: 'src', nextAction: 'today', noTouchDays: 7, hasNewMatches: true })).toEqual({
      status: ['active'],
      source_id: ['src'],
      next_action: 'today',
      no_touch_days: 7,
      has_new_matches: true,
    });
  });

  it('trims the search and drops a blank one', () => {
    expect(toListFilter({ search: '  Lozenets ' }).search).toBe('Lozenets');
    expect(toListFilter({ search: '   ' })).not.toHaveProperty('search');
  });

  it('leaves hasNewMatches false out', () => {
    expect(toListFilter({ hasNewMatches: false })).toEqual({ status: ['active'] });
  });
});
