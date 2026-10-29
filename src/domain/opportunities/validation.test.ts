import { describe, expect, it } from 'vitest';
import { createOpportunitySchema, updateOpportunitySchema } from './validation';

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
