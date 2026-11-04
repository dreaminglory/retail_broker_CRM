import { describe, expect, it } from 'vitest';
import { addCandidateSchema, setLinkStatusSchema } from './validation';

const OPPORTUNITY_ID = '11111111-1111-4111-8111-111111111111';
const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

describe('addCandidateSchema', () => {
  it('accepts an opportunity and a property', () => {
    expect(addCandidateSchema.parse({ opportunity_id: OPPORTUNITY_ID, property_id: PROPERTY_ID })).toEqual({
      opportunity_id: OPPORTUNITY_ID,
      property_id: PROPERTY_ID,
    });
  });

  it('needs a chosen property, with an i18n key', () => {
    const result = addCandidateSchema.safeParse({ opportunity_id: OPPORTUNITY_ID, property_id: '' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['property_id'], message: 'validation.property_required' });
  });
});

describe('setLinkStatusSchema', () => {
  it('keeps a trimmed reason on a rejection', () => {
    expect(setLinkStatusSchema.parse({ status: 'rejected', rejected_reason: '  Too far from the metro ' })).toEqual({
      status: 'rejected',
      rejected_reason: 'Too far from the metro',
    });
  });

  it('makes the reason optional, and an empty one null', () => {
    expect(setLinkStatusSchema.parse({ status: 'rejected' })).toEqual({ status: 'rejected', rejected_reason: null });
    expect(setLinkStatusSchema.parse({ status: 'rejected', rejected_reason: '   ' })).toEqual({
      status: 'rejected',
      rejected_reason: null,
    });
  });

  it('drops the reason for any other status (the database allows it only on rejected)', () => {
    expect(setLinkStatusSchema.parse({ status: 'offered', rejected_reason: 'stale' })).toEqual({
      status: 'offered',
      rejected_reason: null,
    });
  });

  it('refuses an unknown status and an overlong reason', () => {
    expect(setLinkStatusSchema.safeParse({ status: 'subject' }).success).toBe(false);
    expect(setLinkStatusSchema.safeParse({ status: 'rejected', rejected_reason: 'x'.repeat(501) }).success).toBe(false);
  });
});
