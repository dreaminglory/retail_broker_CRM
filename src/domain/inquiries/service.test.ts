import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import { InquiryService } from './service';
import type { Inquiry } from './types';

const AGENCY_ID = '11111111-1111-4111-8111-111111111111';
const INQUIRY_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = '44444444-4444-4444-8444-444444444444';
const OUTSIDER_ID = '55555555-5555-4555-8555-555555555555';
const STAGE_ID = '66666666-6666-4666-8666-666666666666';

const INQUIRY = {
  id: INQUIRY_ID,
  agency_id: AGENCY_ID,
  status: 'new',
  assigned_to: null,
  caller_name: 'Ivan',
  caller_phone: null,
  caller_email: null,
} as Inquiry;

/** Answers just the queries InquiryService makes, and records what it reads and writes. */
function fakeDb(inquiry: Inquiry = INQUIRY) {
  const tables: string[] = [];
  const writes: { table: string; values: Record<string, unknown> }[] = [];

  const db = {
    from(table: string) {
      tables.push(table);
      let userId: string | undefined;
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => {
          if (column === 'user_id') userId = value;
          return chain;
        },
        insert: (values: Record<string, unknown>) => {
          writes.push({ table, values });
          return chain;
        },
        update: (values: Record<string, unknown>) => {
          writes.push({ table, values });
          return chain;
        },
        single: async () => ({ data: inquiry, error: null }),
        maybeSingle: async () => ({
          data: userId === MEMBER_ID ? { user_id: userId } : null,
          error: null,
        }),
      };
      return chain;
    },
  };

  return { db: db as unknown as SupabaseClient, tables, writes };
}

const notMember = expect.objectContaining({ code: 'errors.inquiries.assignee_not_member' });

describe('InquiryService assignee check', () => {
  it('create refuses an assignee outside the agency', async () => {
    const { db, writes } = fakeDb();
    await expect(
      new InquiryService(db).create(AGENCY_ID, USER_ID, { caller_name: 'Ivan', assigned_to: OUTSIDER_ID })
    ).rejects.toEqual(notMember);
    expect(writes).toEqual([]);
  });

  it('create accepts an active member', async () => {
    const { db, writes } = fakeDb();
    await new InquiryService(db).create(AGENCY_ID, USER_ID, { caller_name: 'Ivan', assigned_to: MEMBER_ID });
    expect(writes[0].values.assigned_to).toBe(MEMBER_ID);
  });

  it('update refuses an assignee outside the agency', async () => {
    const { db, writes } = fakeDb();
    await expect(
      new InquiryService(db).update(INQUIRY_ID, AGENCY_ID, { assigned_to: OUTSIDER_ID })
    ).rejects.toEqual(notMember);
    expect(writes).toEqual([]);
  });

  it('update skips the member lookup when the assignee is unchanged', async () => {
    const { db, tables } = fakeDb({ ...INQUIRY, assigned_to: OUTSIDER_ID });
    await new InquiryService(db).update(INQUIRY_ID, AGENCY_ID, { assigned_to: OUTSIDER_ID, subject: 'Flat' });
    expect(tables).not.toContain('agency_memberships');
  });

  it('update can unassign without a member lookup', async () => {
    const { db, tables } = fakeDb({ ...INQUIRY, assigned_to: MEMBER_ID });
    await new InquiryService(db).update(INQUIRY_ID, AGENCY_ID, { assigned_to: null });
    expect(tables).not.toContain('agency_memberships');
  });

  it('convert refuses an assignee outside the agency before writing anything', async () => {
    const { db, writes } = fakeDb();
    await expect(
      new InquiryService(db).convert(INQUIRY_ID, AGENCY_ID, {
        create_contact: { type: 'person', first_name: 'Ivan' },
        opportunity_title: 'Flat',
        opportunity_type: 'buyer',
        stage_id: STAGE_ID,
        assigned_to: OUTSIDER_ID,
      })
    ).rejects.toEqual(notMember);
    expect(writes).toEqual([]);
  });
});

describe('InquiryService.convert errors', () => {
  const INPUT = {
    create_contact: { type: 'person' as const },
    opportunity_title: 'Flat',
    opportunity_type: 'buyer' as const,
    stage_id: STAGE_ID,
  };

  function serviceWith(options: Partial<Parameters<typeof createFakeSupabase>[0]>) {
    const { client } = createFakeSupabase({
      role: 'broker',
      tables: {
        inquiries: { ...INQUIRY, caller_phone: '+359888123456' },
        contacts: { id: 'contact-1' },
        opportunities: { id: 'opportunity-1' },
      },
      ...options,
    });
    return new InquiryService(client as SupabaseClient);
  }

  it('losing the caller\'s phone and email fails the conversion', async () => {
    const service = serviceWith({
      failingTables: ['rpc:convert_inquiry'],
    });

    const error = await service.convert(INQUIRY_ID, AGENCY_ID, INPUT).catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.saveFailed');
  });

  it('a refusal the RPC raises keeps its i18n key', async () => {
    const service = serviceWith({
      rpcErrors: { convert_inquiry: { code: 'P0001', message: 'errors.inquiries.contact_creation_failed' } },
    });

    await expect(service.convert(INQUIRY_ID, AGENCY_ID, INPUT)).rejects.toMatchObject({
      code: 'errors.inquiries.contact_creation_failed',
    });
  });

  it('a database message that is not an i18n key never reaches the caller', async () => {
    const service = serviceWith({
      rpcErrors: { convert_inquiry: { code: 'P0001', message: 'trigger said no' } },
    });

    await expect(service.convert(INQUIRY_ID, AGENCY_ID, INPUT)).rejects.toMatchObject({ code: 'errors.saveFailed' });
  });
});

describe('InquiryService final states', () => {
  it.each(['converted', 'dismissed'] as const)('update refuses to change a %s inquiry', async (status) => {
    const { db, writes } = fakeDb({ ...INQUIRY, status });
    await expect(
      new InquiryService(db).update(INQUIRY_ID, AGENCY_ID, { assigned_to: null })
    ).rejects.toEqual(expect.objectContaining({ code: 'errors.inquiries.final_state' }));
    expect(writes).toEqual([]);
  });

  it('an invalid status move throws a DomainError with an i18n key', async () => {
    const { db } = fakeDb({ ...INQUIRY, status: 'contacted' });
    const error = await new InquiryService(db).markContacted(INQUIRY_ID, AGENCY_ID).catch((e) => e);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.inquiries.invalid_transition');
  });
});

describe('InquiryService.edit', () => {
  it('leaves an unparseable stored phone out of the write', async () => {
    const { db, writes } = fakeDb({ ...INQUIRY, caller_phone: 'call after 5' });
    await new InquiryService(db).edit(INQUIRY_ID, AGENCY_ID, {
      caller_phone: 'call after 5',
      subject: 'Flat',
    });
    expect(writes[0].values).toEqual({ subject: 'Flat' });
  });

  it('writes a corrected phone as E.164', async () => {
    const { db, writes } = fakeDb({ ...INQUIRY, caller_phone: 'call after 5' });
    await new InquiryService(db).edit(INQUIRY_ID, AGENCY_ID, { caller_phone: '0888 123 456' });
    expect(writes[0].values.caller_phone).toBe('+359888123456');
  });
});
