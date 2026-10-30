import { describe, expect, it } from 'vitest';
import {
  callerContactMethods,
  canAssignTo,
  convertInquirySchema,
  createInquirySchema,
  editInquirySchema,
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

describe('inquiry schemas: caller normalisation', () => {
  it.each([
    ['createInquirySchema', createInquirySchema],
    ['updateInquirySchema', updateInquirySchema],
  ])('%s stores a local phone as E.164', (_label, schema) => {
    const parsed = schema.parse({ caller_phone: '0888 123 456' });
    expect(parsed.caller_phone).toBe('+359888123456');
  });

  it.each([
    ['createInquirySchema', createInquirySchema],
    ['updateInquirySchema', updateInquirySchema],
  ])('%s lowercases and trims the email', (_label, schema) => {
    const parsed = schema.parse({ caller_email: ' Ivan@Example.BG ' });
    expect(parsed.caller_email).toBe('ivan@example.bg');
  });

  it.each([
    ['createInquirySchema', createInquirySchema],
    ['updateInquirySchema', updateInquirySchema],
  ])('%s rejects an unparseable phone with an i18n key', (_label, schema) => {
    const result = schema.safeParse({ caller_name: 'Ivan', caller_phone: 'call me' });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.caller_phone).toEqual(['validation.invalid_phone']);
  });

  it('updateInquirySchema clears empty caller fields to null', () => {
    const parsed = updateInquirySchema.parse({ caller_phone: '', caller_email: '' });
    expect(parsed.caller_phone).toBeNull();
    expect(parsed.caller_email).toBeNull();
  });

  it('updateInquirySchema leaves omitted caller fields undefined', () => {
    const parsed = updateInquirySchema.parse({ subject: 'Flat' });
    expect(parsed.caller_phone).toBeUndefined();
    expect(parsed.caller_email).toBeUndefined();
  });

  it('parsing twice gives the same value', () => {
    const once = createInquirySchema.parse({ caller_phone: '0888 123 456' });
    expect(createInquirySchema.parse(once).caller_phone).toBe('+359888123456');
  });
});

describe('inquiry schemas: immutable fields', () => {
  it('createInquirySchema keeps raw_payload unchanged', () => {
    const rawPayload = { phone: '0888 123 456', Email: 'IVAN@EXAMPLE.BG' };
    const parsed = createInquirySchema.parse({ caller_phone: '0888 123 456', raw_payload: rawPayload });
    expect(parsed.raw_payload).toEqual({ phone: '0888 123 456', Email: 'IVAN@EXAMPLE.BG' });
  });

  it('updateInquirySchema strips raw_payload and received_at', () => {
    const parsed = updateInquirySchema.parse({
      subject: 'Flat',
      raw_payload: { tampered: true },
      received_at: '2020-01-01T00:00:00Z',
    });
    expect(parsed).not.toHaveProperty('raw_payload');
    expect(parsed).not.toHaveProperty('received_at');
  });
});

describe('editInquirySchema', () => {
  it('accepts every editable field and normalises the caller', () => {
    const parsed = editInquirySchema.parse({
      source_id: null,
      assigned_to: BROKER_ID,
      caller_name: 'Ivan',
      caller_phone: '0888 123 456',
      caller_email: 'Ivan@Example.BG',
      subject: 'Flat',
      description: 'Near the park',
      external_ref: 'IMOT-1',
    });
    expect(parsed).toEqual({
      source_id: null,
      assigned_to: BROKER_ID,
      caller_name: 'Ivan',
      caller_phone: '+359888123456',
      caller_email: 'ivan@example.bg',
      subject: 'Flat',
      description: 'Near the park',
      external_ref: 'IMOT-1',
    });
  });

  it('strips everything that may not be edited', () => {
    const parsed = editInquirySchema.parse({
      caller_name: 'Ivan',
      raw_payload: { tampered: true },
      received_at: '2020-01-01T00:00:00Z',
      status: 'converted',
      contact_id: BROKER_ID,
      opportunity_id: BROKER_ID,
    });
    expect(parsed).toEqual({ caller_name: 'Ivan' });
  });

  it('refuses an edit that leaves no caller details and no content', () => {
    const result = editInquirySchema.safeParse({
      caller_name: null,
      caller_phone: null,
      caller_email: null,
      subject: null,
      description: null,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.caller_name).toEqual(['validation.inquiry_needs_info']);
  });

  it('updateInquirySchema carries external_ref through to the service', () => {
    expect(updateInquirySchema.parse({ external_ref: 'IMOT-1' }).external_ref).toBe('IMOT-1');
  });
});

describe('canAssignTo', () => {
  const OTHER_ID = '33333333-3333-4333-8333-333333333333';

  it('allows an active member of the agency', () => {
    expect(canAssignTo(BROKER_ID, null, [BROKER_ID])).toBe(true);
  });

  it('refuses someone who is not an active member', () => {
    expect(canAssignTo(OTHER_ID, BROKER_ID, [BROKER_ID])).toBe(false);
  });

  it('keeps a deactivated assignee when the edit leaves them in place', () => {
    expect(canAssignTo(OTHER_ID, OTHER_ID, [BROKER_ID])).toBe(true);
  });

  it('always allows unassigning', () => {
    expect(canAssignTo(null, BROKER_ID, [BROKER_ID])).toBe(true);
  });
});

describe('callerContactMethods', () => {
  it('normalises a stored local phone and mixed-case email, phone first', () => {
    expect(
      callerContactMethods({ caller_phone: '0888 123 456', caller_email: 'Ivan@Example.BG' })
    ).toEqual([
      { type: 'phone', value: '+359888123456', label: null, is_primary: true },
      { type: 'email', value: 'ivan@example.bg', label: null, is_primary: false },
    ]);
  });

  it('makes the email primary when there is no phone', () => {
    expect(callerContactMethods({ caller_phone: null, caller_email: 'ivan@example.bg' })).toEqual([
      { type: 'email', value: 'ivan@example.bg', label: null, is_primary: true },
    ]);
  });

  it('keeps a phone that cannot be parsed rather than losing it', () => {
    expect(callerContactMethods({ caller_phone: 'legacy 123', caller_email: null })).toEqual([
      { type: 'phone', value: 'legacy 123', label: null, is_primary: true },
    ]);
  });

  it('returns nothing when the caller left no details', () => {
    expect(callerContactMethods({ caller_phone: null, caller_email: null })).toEqual([]);
  });
});
