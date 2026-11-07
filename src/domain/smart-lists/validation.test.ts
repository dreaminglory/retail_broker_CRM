import { describe, expect, it } from 'vitest';
import {
  inquiryListFilterSchema,
  listNameSchema,
  opportunityListFilterSchema,
  parseStoredFilter,
} from './validation';

const UUID = '6f1c2b0e-8c1a-4a57-9f3e-1d2c3b4a5f60';

describe('opportunityListFilterSchema', () => {
  it('accepts every key of the shape', () => {
    const filter = {
      status: ['active', 'nurture'],
      type: ['buyer'],
      stage_id: [UUID],
      temperature: ['hot'],
      assigned_to: 'me',
      source_id: [UUID],
      next_action: 'overdue',
      no_touch_days: 14,
      has_new_matches: true,
      search: 'Lozenets',
      sort: 'last_touch_asc',
    };
    expect(opportunityListFilterSchema.parse(filter)).toEqual(filter);
  });

  it('accepts an empty filter and the three assigned_to forms', () => {
    expect(opportunityListFilterSchema.parse({})).toEqual({});
    for (const assigned_to of ['me', 'unassigned', UUID]) {
      expect(opportunityListFilterSchema.parse({ assigned_to })).toEqual({ assigned_to });
    }
  });

  it('refuses unknown keys, bad enums and bad ids', () => {
    expect(opportunityListFilterSchema.safeParse({ colour: 'red' }).success).toBe(false);
    expect(opportunityListFilterSchema.safeParse({ status: ['open'] }).success).toBe(false);
    expect(opportunityListFilterSchema.safeParse({ next_action: 'soon' }).success).toBe(false);
    expect(opportunityListFilterSchema.safeParse({ sort: 'new_matches_desc' }).success).toBe(false);
    expect(opportunityListFilterSchema.safeParse({ assigned_to: 'someone' }).success).toBe(false);
    expect(opportunityListFilterSchema.safeParse({ stage_id: ['not-a-uuid'] }).success).toBe(false);
  });

  it('takes no_touch_days only as a whole number of at least 1', () => {
    for (const no_touch_days of [0, -3, 2.5, '3', null]) {
      expect(opportunityListFilterSchema.safeParse({ no_touch_days }).success).toBe(false);
    }
    expect(opportunityListFilterSchema.parse({ no_touch_days: 1 })).toEqual({ no_touch_days: 1 });
  });

  it('trims the search', () => {
    expect(opportunityListFilterSchema.parse({ search: '  Vitosha ' })).toEqual({ search: 'Vitosha' });
  });
});

describe('inquiryListFilterSchema', () => {
  it('accepts its keys and refuses the opportunity-only ones', () => {
    const filter = { status: ['new'], assigned_to: 'unassigned', source_id: [UUID], search: 'Ivan', sort: 'received_asc' };
    expect(inquiryListFilterSchema.parse(filter)).toEqual(filter);
    expect(inquiryListFilterSchema.safeParse({ next_action: 'none' }).success).toBe(false);
    expect(inquiryListFilterSchema.safeParse({ sort: 'last_touch_asc' }).success).toBe(false);
    expect(inquiryListFilterSchema.safeParse({ status: ['active'] }).success).toBe(false);
  });
});

describe('listNameSchema', () => {
  it('trims and keeps 1 to 60 characters', () => {
    expect(listNameSchema.parse('  My buyers ')).toBe('My buyers');
    expect(listNameSchema.safeParse('   ').success).toBe(false);
    expect(listNameSchema.safeParse('x'.repeat(61)).success).toBe(false);
    expect(listNameSchema.parse('x'.repeat(60))).toHaveLength(60);
  });
});

describe('parseStoredFilter', () => {
  it('returns the filter of a stored list that still parses', () => {
    expect(parseStoredFilter('opportunity', { temperature: ['hot'], assigned_to: 'me' })).toEqual({
      ok: true,
      filter: { entity: 'opportunity', filter: { temperature: ['hot'], assigned_to: 'me' } },
    });
    expect(parseStoredFilter('inquiry', { status: ['new'] })).toEqual({
      ok: true,
      filter: { entity: 'inquiry', filter: { status: ['new'] } },
    });
  });

  it('gives { ok: false } for a filter of an old shape or a wrong entity', () => {
    expect(parseStoredFilter('opportunity', { stage: 'New' })).toEqual({ ok: false });
    expect(parseStoredFilter('opportunity', { sort: 'new_matches_desc' })).toEqual({ ok: false });
    expect(parseStoredFilter('inquiry', { next_action: 'none' })).toEqual({ ok: false });
    expect(parseStoredFilter('opportunity', 'not an object')).toEqual({ ok: false });
    expect(parseStoredFilter('contact', {})).toEqual({ ok: false });
  });
});
