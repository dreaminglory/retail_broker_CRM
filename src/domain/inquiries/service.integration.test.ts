import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContactService } from '@/domain/contacts/service';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { InquiryService } from './service';

/** A local-format BG mobile no other suite or run has stored. */
function uniqueMobile(): { local: string; e164: string } {
  const digits = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return { local: `0888 ${digits.slice(0, 3)} ${digits.slice(3)}`, e164: `+359888${digits}` };
}

describeServices('InquiryService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let inquiries: InquiryService;
  let stageId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    inquiries = new InquiryService(broker.db);
    const { data: stage } = await broker.db
      .from('stages')
      .select('id')
      .eq('agency_id', broker.agencyId)
      .eq('name', 'New')
      .single();
    stageId = stage!.id;
  });

  afterAll(() => cleanup.run());

  async function createInquiry(input: Parameters<InquiryService['create']>[2] = { caller_name: 'Test Caller' }) {
    const inquiry = await inquiries.create(broker.agencyId, broker.userId, input);
    cleanup.track('inquiries', inquiry.id);
    return inquiry;
  }

  it('stores the caller normalised and raw_payload as given', async () => {
    const phone = uniqueMobile();
    const inquiry = await createInquiry({
      caller_phone: phone.local,
      caller_email: 'Caller@Example.BG',
      raw_payload: { phone: phone.local },
    });

    expect(inquiry.caller_phone).toBe(phone.e164);
    expect(inquiry.caller_email).toBe('caller@example.bg');
    expect(inquiry.raw_payload).toEqual({ phone: phone.local });
    expect(inquiry.status).toBe('new');
  });

  it('moves new to contacted to dismissed, and dismissed is final', async () => {
    const { id } = await createInquiry();

    expect((await inquiries.markContacted(id, broker.agencyId)).status).toBe('contacted');

    const dismissed = await inquiries.dismiss(id, broker.agencyId, { dismissed_reason: 'Wrong number' });
    expect(dismissed.status).toBe('dismissed');
    expect(dismissed.dismissed_reason).toBe('Wrong number');

    await expect(inquiries.markContacted(id, broker.agencyId)).rejects.toMatchObject({
      code: 'errors.inquiries.invalid_transition',
    });
    await expect(inquiries.edit(id, broker.agencyId, { caller_name: 'Late edit' })).rejects.toMatchObject({
      code: 'errors.inquiries.final_state',
    });
  });

  it('an edit never changes raw_payload or received_at (AC-4)', async () => {
    const before = await createInquiry({ caller_name: 'Before', raw_payload: { original: true } });

    const after = await inquiries.edit(before.id, broker.agencyId, {
      caller_name: 'After',
      raw_payload: { original: false },
      received_at: '2000-01-01T00:00:00Z',
    });

    expect(after.caller_name).toBe('After');
    expect(after.raw_payload).toEqual({ original: true });
    expect(after.received_at).toBe(before.received_at);
  });

  it('assigns to a member of the agency, and refuses anyone else (AC-3)', async () => {
    const { id } = await createInquiry();
    const manager = await signInAs('manager@alpha.bg');
    const outsider = await signInAs('broker@beta.bg');

    const assigned = await inquiries.update(id, broker.agencyId, { assigned_to: manager.userId });
    expect(assigned.assigned_to).toBe(manager.userId);

    await expect(inquiries.update(id, broker.agencyId, { assigned_to: outsider.userId })).rejects.toMatchObject({
      code: 'errors.inquiries.assignee_not_member',
    });
  });

  it('warns about a contact stored in E.164 when the caller left a local number (AC-2)', async () => {
    const phone = uniqueMobile();
    const existing = await new ContactService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'person',
      first_name: 'Existing',
      last_name: 'Duplicate',
      contact_methods: [{ type: 'phone', value: phone.e164, label: null, is_primary: true }],
    });
    cleanup.track('contacts', existing.id);
    const inquiry = await createInquiry({ caller_phone: phone.local });

    const duplicates = await inquiries.findConversionDuplicates(inquiry.id, broker.agencyId, {
      type: 'person',
      first_name: 'Someone',
      last_name: 'Else',
    });

    expect(duplicates.map((d) => d.contact.id)).toEqual([existing.id]);
    expect(duplicates[0].match_reasons).toEqual(['phone']);
  });

  it('converts to an opportunity and a new contact, keeping raw_payload (AC-4)', async () => {
    const phone = uniqueMobile();
    const inquiry = await createInquiry({
      caller_name: 'Petar Georgiev',
      caller_phone: phone.local,
      caller_email: 'Petar@Example.BG',
      raw_payload: { message: 'Looking for a flat' },
    });

    const result = await inquiries.convert(inquiry.id, broker.agencyId, {
      create_contact: { type: 'person' },
      opportunity_title: 'Flat for Petar',
      opportunity_type: 'buyer',
      stage_id: stageId,
      assigned_to: broker.userId,
    });
    cleanup.track('opportunities', result.opportunityId);
    cleanup.track('contacts', result.contactId);

    const converted = await inquiries.getById(inquiry.id, broker.agencyId);
    expect(converted).toMatchObject({
      status: 'converted',
      contact_id: result.contactId,
      opportunity_id: result.opportunityId,
      raw_payload: { message: 'Looking for a flat' },
    });

    const contact = await new ContactService(broker.db).getById(result.contactId!, broker.agencyId);
    expect(contact).toMatchObject({ first_name: 'Petar', last_name: 'Georgiev' });
    expect(contact!.contact_methods.map((m) => [m.type, m.value, m.is_primary]).sort()).toEqual([
      ['email', 'petar@example.bg', false],
      ['phone', phone.e164, true],
    ]);

    const { data: opportunity } = await broker.db
      .from('opportunities')
      .select('inquiry_id, primary_contact_id, assigned_to')
      .eq('id', result.opportunityId)
      .single();
    expect(opportunity).toEqual({
      inquiry_id: inquiry.id,
      primary_contact_id: result.contactId,
      assigned_to: broker.userId,
    });

    await expect(
      inquiries.convert(inquiry.id, broker.agencyId, {
        opportunity_title: 'Twice',
        opportunity_type: 'buyer',
        stage_id: stageId,
      })
    ).rejects.toMatchObject({ code: 'errors.inquiries.invalid_transition' });
  });

  it('reports a contact the database rejects, and leaves the inquiry as it was', async () => {
    const inquiry = await createInquiry({ caller_phone: uniqueMobile().local });

    await expect(
      inquiries.convert(inquiry.id, broker.agencyId, {
        create_contact: { type: 'organization' },
        opportunity_title: 'No company name',
        opportunity_type: 'buyer',
        stage_id: stageId,
      })
    ).rejects.toMatchObject({ code: 'errors.inquiries.contact_creation_failed' });

    expect(await inquiries.getById(inquiry.id, broker.agencyId)).toMatchObject({
      status: 'new',
      contact_id: null,
      opportunity_id: null,
    });
    const { data: opportunities } = await broker.db.from('opportunities').select('id').eq('inquiry_id', inquiry.id);
    expect(opportunities).toEqual([]);
  });

  it('refuses a contact from another agency', async () => {
    const inquiry = await createInquiry();
    const outsider = await signInAs('manager@beta.bg');
    const foreign = await new ContactService(outsider.db).create(outsider.agencyId, outsider.userId, {
      type: 'person',
      first_name: 'Foreign',
    });
    cleanup.track('contacts', foreign.id);

    await expect(
      inquiries.convert(inquiry.id, broker.agencyId, {
        contact_id: foreign.id,
        opportunity_title: 'Foreign link',
        opportunity_type: 'buyer',
        stage_id: stageId,
      })
    ).rejects.toMatchObject({ code: 'errors.not_found' });
  });

  it('keeps another agency from seeing or changing the inquiry', async () => {
    const { id } = await createInquiry();
    const outsider = await signInAs('broker@beta.bg');
    const outsiderInquiries = new InquiryService(outsider.db);

    expect(await outsiderInquiries.getById(id, outsider.agencyId)).toBeNull();
    expect(await outsiderInquiries.getById(id, broker.agencyId)).toBeNull();
    await expect(outsiderInquiries.markContacted(id, broker.agencyId)).rejects.toMatchObject({
      code: 'errors.not_found',
    });
  });
});
