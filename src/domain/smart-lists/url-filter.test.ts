import { describe, expect, it } from 'vitest';
import { opportunityFilterFromParams, opportunityParamsFromFilter } from './url-filter';
import { opportunityListFilterSchema } from './validation';

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
