import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_LISTS,
  HOT_NO_TOUCH_DAYS,
  SELLER_NO_TOUCH_DAYS,
  canSwitchListScope,
  findBuiltInList,
  isBuiltInListId,
  resolveListScope,
  scopedFilter,
  visibleBuiltInLists,
} from './built-in';
import { inquiryListFilterSchema, opportunityListFilterSchema } from './validation';

describe('BUILT_IN_LISTS', () => {
  it('holds the nine lists of the spec, in its order', () => {
    expect(BUILT_IN_LISTS.map((l) => l.id)).toEqual([
      'no-next-action',
      'overdue',
      'due-today',
      'hot-no-touch',
      'sellers-need-update',
      'new-matches',
      'unassigned-deals',
      'new-inquiries',
      'unassigned-inquiries',
    ]);
  });

  it('every preset parses with the strict schema of its entity', () => {
    for (const list of BUILT_IN_LISTS) {
      const schema = list.entity === 'opportunity' ? opportunityListFilterSchema : inquiryListFilterSchema;
      expect(schema.parse(list.filter), list.id).toEqual(list.filter);
    }
  });

  it('every list has its own i18n key under smartLists.builtIn', () => {
    const keys = BUILT_IN_LISTS.map((l) => l.nameKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^smartLists\.builtIn\./);
  });

  it('carries the thresholds and orders of the spec (A2, founder Checkpoint 1)', () => {
    expect(HOT_NO_TOUCH_DAYS).toBe(3);
    expect(SELLER_NO_TOUCH_DAYS).toBe(14);
    expect(findBuiltInList('hot-no-touch')!.filter).toMatchObject({ temperature: ['hot'], no_touch_days: 3 });
    expect(findBuiltInList('sellers-need-update')!.filter).toMatchObject({ type: ['seller', 'landlord'], no_touch_days: 14 });
    expect(findBuiltInList('new-matches')!.filter).toEqual({
      status: ['active', 'nurture'],
      type: ['buyer', 'tenant'],
      has_new_matches: true,
      sort: 'last_touch_asc',
    });
    expect(findBuiltInList('overdue')!.filter.sort).toBe('next_action_asc');
    expect(findBuiltInList('new-inquiries')!.filter).toEqual({ status: ['new'], sort: 'received_asc' });
  });

  it('only the two unassigned lists are agency-only', () => {
    expect(BUILT_IN_LISTS.filter((l) => l.scope === 'agency-only').map((l) => l.id)).toEqual([
      'unassigned-deals',
      'unassigned-inquiries',
    ]);
  });
});

describe('isBuiltInListId / findBuiltInList', () => {
  it('knows the built-in ids only', () => {
    expect(isBuiltInListId('overdue')).toBe(true);
    expect(isBuiltInListId('6f1c2b0e-8c1a-4a57-9f3e-1d2c3b4a5f60')).toBe(false);
    expect(findBuiltInList('nope')).toBeUndefined();
  });
});

describe('scope by role (rule 1, AD-044)', () => {
  it('a broker always gets mine, even when asking for agency', () => {
    expect(canSwitchListScope('broker')).toBe(false);
    expect(resolveListScope('broker', 'agency')).toBe('mine');
  });

  it('owners and managers get mine by default and agency when asked', () => {
    for (const role of ['owner', 'manager']) {
      expect(canSwitchListScope(role)).toBe(true);
      expect(resolveListScope(role, undefined)).toBe('mine');
      expect(resolveListScope(role, 'agency')).toBe('agency');
      expect(resolveListScope(role, 'everything')).toBe('mine');
    }
  });

  it('a broker sees seven lists, without the unassigned ones; a manager sees nine', () => {
    expect(visibleBuiltInLists('broker')).toHaveLength(7);
    expect(visibleBuiltInLists('broker').some((l) => l.scope === 'agency-only')).toBe(false);
    expect(visibleBuiltInLists('manager')).toHaveLength(9);
    expect(visibleBuiltInLists('owner')).toHaveLength(9);
    expect(visibleBuiltInLists('unknown')).toHaveLength(7);
  });
});

describe('scopedFilter', () => {
  it('adds assigned_to me on mine and nothing on agency', () => {
    const list = findBuiltInList('overdue')!;
    expect(scopedFilter(list, 'mine')).toEqual({ entity: 'opportunity', filter: { ...list.filter, assigned_to: 'me' } });
    expect(scopedFilter(list, 'agency')).toEqual({ entity: 'opportunity', filter: list.filter });
  });

  it('leaves the agency-only lists as defined on either scope', () => {
    const list = findBuiltInList('unassigned-inquiries')!;
    expect(scopedFilter(list, 'mine')).toEqual({ entity: 'inquiry', filter: list.filter });
    expect(scopedFilter(list, 'agency')).toEqual({ entity: 'inquiry', filter: list.filter });
  });
});
