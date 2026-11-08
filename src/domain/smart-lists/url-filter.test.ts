import { describe, expect, it } from 'vitest';
import {
  inquiryFilterFromParams,
  inquiryParamsFromFilter,
  listFilterFromParams,
  listParamsFromFilter,
  shownExactly,
  opportunityFilterFromParams,
  opportunityParamsFromFilter,
} from './url-filter';
import { inquiryListFilterSchema, opportunityListFilterSchema } from './validation';

const STAGE = '6f1c2b0e-8c1a-4a57-9f3e-1d2c3b4a5f60';
const BROKER = '0b8d3c1e-2f4a-4b6c-8d9e-0a1b2c3d4e5f';
const SOURCE = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';

describe('opportunityFilterFromParams: the opportunity list URL as a saved filter', () => {
  it('no params is the active deals, newest first (what the list shows)', () => {
    expect(opportunityFilterFromParams({})).toEqual({ status: ['active'], sort: 'created_desc' });
  });

  it('maps every URL filter to its filter key', () => {
    const filter = opportunityFilterFromParams({
      search: ' Lozenets ',
      status: 'nurture',
      type: 'buyer',
      stage: STAGE,
      broker: BROKER,
      temperature: 'warm',
      source: SOURCE,
      next: 'overdue',
      untouched: '14',
      matches: 'new',
      page: '3',
    });
    expect(filter).toEqual({
      status: ['nurture'],
      type: ['buyer'],
      stage_id: [STAGE],
      temperature: ['warm'],
      assigned_to: BROKER,
      source_id: [SOURCE],
      next_action: 'overdue',
      no_touch_days: 14,
      has_new_matches: true,
      search: 'Lozenets',
      sort: 'created_desc',
    });
    expect(opportunityListFilterSchema.parse(filter)).toEqual(filter);
  });

  it('status all keeps every status', () => {
    expect(opportunityFilterFromParams({ status: 'all' }).status).toHaveLength(5);
  });

  it('ignores bad values as the list page does', () => {
    expect(
      opportunityFilterFromParams({
        status: 'gone',
        type: 'all',
        stage: 'not-a-uuid',
        broker: 'x',
        temperature: 'boiling',
        source: '1',
        next: 'later',
        untouched: '-3',
        matches: 'yes',
      })
    ).toEqual({ status: ['active'], sort: 'created_desc' });
  });
});

describe('opportunityParamsFromFilter: Edit filters opens the list with the saved filter', () => {
  it('a filter saved from the URL opens with the same URL', () => {
    const params = {
      search: 'Lozenets',
      status: 'nurture',
      type: 'buyer',
      stage: STAGE,
      broker: BROKER,
      temperature: 'warm',
      source: SOURCE,
      next: 'overdue',
      untouched: '14',
      matches: 'new',
    };
    const back = opportunityParamsFromFilter(opportunityFilterFromParams(params));
    expect(Object.fromEntries(back)).toEqual(params);
    expect(opportunityFilterFromParams(Object.fromEntries(back))).toEqual(opportunityFilterFromParams(params));
  });

  it('active is the default and all statuses is status=all', () => {
    expect(opportunityParamsFromFilter({ status: ['active'] }).toString()).toBe('');
    expect(opportunityParamsFromFilter({}).toString()).toBe('');
    expect(opportunityParamsFromFilter(opportunityFilterFromParams({ status: 'all' })).get('status')).toBe('all');
  });

  it('leaves out what the list page cannot show (several values, me, unassigned)', () => {
    const params = opportunityParamsFromFilter({
      status: ['active', 'nurture'],
      type: ['buyer', 'tenant'],
      assigned_to: 'me',
    });
    expect(params.toString()).toBe('');
    expect(opportunityParamsFromFilter({ assigned_to: 'unassigned' }).toString()).toBe('');
  });
});

describe('inquiry lists: the inquiry list URL as a saved filter and back', () => {
  it('no params is every inquiry, newest first, as the inquiry list shows', () => {
    expect(inquiryFilterFromParams({})).toEqual({ sort: 'received_desc' });
    expect(inquiryFilterFromParams({ status: 'all' })).toEqual({ sort: 'received_desc' });
  });

  it('maps status and search; bad values and the page are ignored', () => {
    const filter = inquiryFilterFromParams({ status: 'new', search: ' imot.bg ', page: '2', id: STAGE });
    expect(filter).toEqual({ status: ['new'], search: 'imot.bg', sort: 'received_desc' });
    expect(inquiryListFilterSchema.parse(filter)).toEqual(filter);
    expect(inquiryFilterFromParams({ status: 'gone', search: '   ' })).toEqual({ sort: 'received_desc' });
  });

  it('round-trips through the URL', () => {
    const params = { status: 'contacted', search: 'Ivan' };
    expect(Object.fromEntries(inquiryParamsFromFilter(inquiryFilterFromParams(params)))).toEqual(params);
    expect(inquiryParamsFromFilter({ status: ['new', 'contacted'], assigned_to: 'me' }).toString()).toBe('');
  });
});

describe('listFilterFromParams and listParamsFromFilter pick the mapping by entity', () => {
  it('maps each entity with its own list page rules', () => {
    expect(listFilterFromParams('opportunity', { status: 'won' })).toEqual({ entity: 'opportunity', filter: { status: ['won'], sort: 'created_desc' } });
    expect(listFilterFromParams('inquiry', { status: 'new' })).toEqual({ entity: 'inquiry', filter: { status: ['new'], sort: 'received_desc' } });
    expect(listParamsFromFilter({ entity: 'inquiry', filter: { status: ['new'] } }).toString()).toBe('status=new');
  });
});

describe('shownExactly: can the list page show this saved filter as it is? (Update list)', () => {
  it('a filter saved from the page is shown exactly', () => {
    expect(shownExactly(listFilterFromParams('opportunity', { type: 'buyer', temperature: 'warm', status: 'all' }))).toBe(true);
    expect(shownExactly(listFilterFromParams('inquiry', { status: 'new', search: 'Ivan' }))).toBe(true);
  });

  it('defaults the page applies anyway count as shown (no status = active, no sort = newest)', () => {
    expect(shownExactly({ entity: 'opportunity', filter: { temperature: ['hot'] } })).toBe(true);
    expect(shownExactly({ entity: 'opportunity', filter: { status: ['archived', 'won', 'lost', 'nurture', 'active'] } })).toBe(true);
    expect(shownExactly({ entity: 'inquiry', filter: {} })).toBe(true);
    expect(shownExactly({ entity: 'inquiry', filter: { status: ['dismissed', 'new', 'contacted', 'converted'] } })).toBe(true);
  });

  it('me, unassigned, several values or another sort cannot be shown', () => {
    expect(shownExactly({ entity: 'opportunity', filter: { temperature: ['hot'], assigned_to: 'me' } })).toBe(false);
    expect(shownExactly({ entity: 'opportunity', filter: { assigned_to: 'unassigned' } })).toBe(false);
    expect(shownExactly({ entity: 'opportunity', filter: { type: ['buyer', 'tenant'] } })).toBe(false);
    expect(shownExactly({ entity: 'opportunity', filter: { sort: 'last_touch_asc' } })).toBe(false);
    expect(shownExactly({ entity: 'inquiry', filter: { assigned_to: 'me' } })).toBe(false);
    expect(shownExactly({ entity: 'inquiry', filter: { sort: 'received_asc' } })).toBe(false);
  });
});
