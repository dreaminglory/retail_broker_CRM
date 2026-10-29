import { describe, expect, it } from 'vitest';
import {
  convertInquirySchema,
  createInquirySchema,
  updateInquirySchema,
} from './validation';

const BROKER_ID = '11111111-1111-4111-8111-111111111111';
const STAGE_ID = '22222222-2222-4222-8222-222222222222';

describe('inquiry schemas: assigned_to', () => {
  it.each([
    ['the "none" select sentinel', 'none'],
    ['an empty string', ''],
    ['null', null],
  ])('createInquirySchema parses %s to null', (_label, value) => {
    const parsed = createInquirySchema.parse({ caller_name: 'Ivan', assigned_to: value });
    expect(parsed.assigned_to).toBeNull();
  });

  it('createInquirySchema keeps a broker uuid', () => {
    const parsed = createInquirySchema.parse({ caller_name: 'Ivan', assigned_to: BROKER_ID });
    expect(parsed.assigned_to).toBe(BROKER_ID);
  });

  it('createInquirySchema still rejects a non-uuid', () => {
    const result = createInquirySchema.safeParse({ caller_name: 'Ivan', assigned_to: 'nobody' });
    expect(result.success).toBe(false);
  });

  it('createInquirySchema leaves an omitted assigned_to undefined', () => {
    const parsed = createInquirySchema.parse({ caller_name: 'Ivan' });
    expect(parsed.assigned_to).toBeUndefined();
  });

  it('updateInquirySchema parses "none" to null', () => {
    expect(updateInquirySchema.parse({ assigned_to: 'none' }).assigned_to).toBeNull();
  });

  it('convertInquirySchema parses "none" to null', () => {
    const parsed = convertInquirySchema.parse({
      opportunity_title: 'Flat in Lozenets',
      opportunity_type: 'buyer',
      stage_id: STAGE_ID,
      assigned_to: 'none',
    });
    expect(parsed.assigned_to).toBeNull();
  });
});
