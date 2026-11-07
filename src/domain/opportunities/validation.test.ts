import { describe, expect, it } from 'vitest';
import { createOpportunitySchema, parseOpportunityListFilters, updateOpportunitySchema } from './validation';

const STAGE_ID = '22222222-2222-4222-8222-222222222222';

describe('opportunity schemas: optional references', () => {
  it('createOpportunitySchema parses "none" selects to null', () => {
    const parsed = createOpportunitySchema.parse({
      title: 'Flat in Lozenets',
      type: 'buyer',
      stage_id: STAGE_ID,
      source_id: 'none',
      inquiry_id: 'none',
      primary_contact_id: 'none',
      assigned_to: 'none',
    });
    expect(parsed).toMatchObject({
      source_id: null,
      inquiry_id: null,
      primary_contact_id: null,
      assigned_to: null,
    });
  });

  it('updateOpportunitySchema parses "none" selects to null', () => {
    const parsed = updateOpportunitySchema.parse({
      source_id: 'none',
      primary_contact_id: 'none',
      assigned_to: 'none',
    });
    expect(parsed).toMatchObject({ source_id: null, primary_contact_id: null, assigned_to: null });
  });
});

describe('parseOpportunityListFilters', () => {
  const BROKER_ID = '11111111-4444-4444-8444-444444444444';

  const SOURCE_ID = '33333333-4444-4444-8444-444444444444';

  it('reads a broker id and a temperature', () => {
    expect(parseOpportunityListFilters({ broker: BROKER_ID, temperature: 'hot' })).toMatchObject({
      assignedTo: BROKER_ID,
      temperature: 'hot',
    });
  });

  it('reads the smart-list filters: source, next action, untouched days, new matches', () => {
    expect(
      parseOpportunityListFilters({ source: SOURCE_ID, next: 'overdue', untouched: '14', matches: 'new' })
    ).toEqual({
      assignedTo: undefined,
      temperature: undefined,
      sourceId: SOURCE_ID,
      nextAction: 'overdue',
      noTouchDays: 14,
      hasNewMatches: true,
    });
  });

  it('treats missing params as no filter', () => {
    expect(parseOpportunityListFilters({})).toEqual({
      assignedTo: undefined,
      temperature: undefined,
      sourceId: undefined,
      nextAction: undefined,
      noTouchDays: undefined,
      hasNewMatches: false,
    });
  });

  it.each(['all', '', 'not-a-uuid'])('ignores source %j', (source) => {
    expect(parseOpportunityListFilters({ source }).sourceId).toBeUndefined();
  });

  it.each(['all', '', 'tomorrow'])('ignores next action %j', (next) => {
    expect(parseOpportunityListFilters({ next }).nextAction).toBeUndefined();
  });

  it.each(['', '0', '-3', '2.5', 'ten', '1e1', '3651'])('ignores untouched days %j', (untouched) => {
    expect(parseOpportunityListFilters({ untouched }).noTouchDays).toBeUndefined();
  });

  it.each(['', 'all', 'yes'])('reads matches %j as no new-matches filter', (matches) => {
    expect(parseOpportunityListFilters({ matches }).hasNewMatches).toBe(false);
  });

  it.each(['all', '', 'not-a-uuid'])('ignores broker %j', (broker) => {
    expect(parseOpportunityListFilters({ broker }).assignedTo).toBeUndefined();
  });

  it.each(['all', '', 'boiling'])('ignores temperature %j', (temperature) => {
    expect(parseOpportunityListFilters({ temperature }).temperature).toBeUndefined();
  });
});
