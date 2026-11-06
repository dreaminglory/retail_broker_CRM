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

    const { inquiry: after } = await inquiries.edit(before.id, broker.agencyId, {
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

    const { inquiry: assigned, previousAssignee } = await inquiries.update(id, broker.agencyId, { assigned_to: manager.userId });
    expect(assigned.assigned_to).toBe(manager.userId);
    expect(previousAssignee).toBeNull();

    const second = await inquiries.update(id, broker.agencyId, { assigned_to: broker.userId });
    expect(second.previousAssignee).toBe(manager.userId);

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
    expect(result).toMatchObject({ ownerId: broker.userId, previousAssignee: null, callerName: 'Petar Georgiev' });

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

describeServices('InquiryService.join against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let manager: TestSession;
  let inquiries: InquiryService;
  let stageId: string;
  let contactId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    manager = await signInAs('manager@alpha.bg');
    inquiries = new InquiryService(broker.db);
    const { data: stage } = await broker.db
      .from('stages')
      .select('id')
      .eq('agency_id', broker.agencyId)
      .eq('name', 'New')
      .single();
    stageId = stage!.id;
    const contact = await new ContactService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'person',
      first_name: 'Joiner',
      last_name: 'Test',
    });
    cleanup.track('contacts', contact.id);
    contactId = contact.id;
  });

  afterAll(() => cleanup.run());

  async function createInquiry(assignedTo: string | null = null) {
    const inquiry = await inquiries.create(broker.agencyId, broker.userId, {
      caller_name: 'Join Caller',
      assigned_to: assignedTo,
    });
    cleanup.track('inquiries', inquiry.id);
    return inquiry;
  }

  async function createDeal(fields: Record<string, unknown> = {}, primaryContactId: string | null = contactId) {
    const { data, error } = await broker.db
      .from('opportunities')
      .insert({
        agency_id: broker.agencyId,
        title: 'Join test deal',
        type: 'buyer',
        stage_id: stageId,
        primary_contact_id: primaryContactId,
        assigned_to: manager.userId,
        ...fields,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    cleanup.track('opportunities', data.id);
    return data.id as string;
  }

  const callBack = { title: 'Call back', due_at: new Date(Date.now() + 3_600_000).toISOString() };

  it('joins an active deal: no new opportunity, the call back is for the owner (AC-1)', async () => {
    const dealId = await createDeal();
    const inquiry = await createInquiry();

    const result = await inquiries.join(inquiry.id, broker.agencyId, {
      contact_id: contactId,
      opportunity_id: dealId,
      task: callBack,
    });

    expect(result).toMatchObject({
      opportunityId: dealId,
      ownerId: manager.userId,
      previousAssignee: null,
      reactivated: false,
    });
    expect(await inquiries.getById(inquiry.id, broker.agencyId)).toMatchObject({
      status: 'converted',
      contact_id: contactId,
      opportunity_id: dealId,
    });
    const { data: tasks } = await broker.db.from('tasks').select('task_type, assigned_to, title').eq('opportunity_id', dealId);
    expect(tasks).toEqual([{ task_type: 'call', assigned_to: manager.userId, title: 'Call back' }]);
    const { data: made } = await broker.db.from('opportunities').select('id').eq('inquiry_id', inquiry.id);
    expect(made).toEqual([]);
  });

  it('reactivates a nurture deal (AC-2)', async () => {
    const dealId = await createDeal({ status: 'nurture', closed_at: new Date().toISOString(), lost_reason: 'timing' });
    const inquiry = await createInquiry();

    const result = await inquiries.join(inquiry.id, broker.agencyId, {
      contact_id: contactId,
      opportunity_id: dealId,
      task: null,
    });

    expect(result.reactivated).toBe(true);
    const { data: deal } = await broker.db.from('opportunities').select('status, closed_at, lost_reason').eq('id', dealId).single();
    expect(deal).toEqual({ status: 'active', closed_at: null, lost_reason: null });
  });

  it('refuses a closed deal and a converted inquiry, changing nothing (AC-4)', async () => {
    const won = await createDeal({ status: 'won', closed_at: new Date().toISOString() });
    const open = await createDeal();
    const inquiry = await createInquiry();

    await expect(
      inquiries.join(inquiry.id, broker.agencyId, { contact_id: contactId, opportunity_id: won, task: null })
    ).rejects.toMatchObject({ code: 'errors.inquiries.join_closed_opportunity' });
    expect(await inquiries.getById(inquiry.id, broker.agencyId)).toMatchObject({ status: 'new', opportunity_id: null });

    await inquiries.join(inquiry.id, broker.agencyId, { contact_id: contactId, opportunity_id: open, task: null });
    await expect(
      inquiries.join(inquiry.id, broker.agencyId, { contact_id: contactId, opportunity_id: open, task: null })
    ).rejects.toMatchObject({ code: 'errors.inquiries.invalid_transition' });
  });

  it('refuses a contact who is not on the deal', async () => {
    const other = await new ContactService(broker.db).create(broker.agencyId, broker.userId, { type: 'person', first_name: 'Other' });
    cleanup.track('contacts', other.id);
    const dealId = await createDeal();
    const inquiry = await createInquiry();

    await expect(
      inquiries.join(inquiry.id, broker.agencyId, { contact_id: other.id, opportunity_id: dealId, task: null })
    ).rejects.toMatchObject({ code: 'errors.inquiries.join_contact_not_on_opportunity' });
  });

  it('lists active and nurture deals, as primary contact or participant, but not won, lost or archived (AC-3)', async () => {
    const solo = await new ContactService(broker.db).create(broker.agencyId, broker.userId, { type: 'person', first_name: 'Lister' });
    cleanup.track('contacts', solo.id);
    const active = await createDeal({ title: 'Active' }, solo.id);
    const nurture = await createDeal({ title: 'Nurture', status: 'nurture', closed_at: new Date().toISOString() }, solo.id);
    await createDeal({ title: 'Won', status: 'won', closed_at: new Date().toISOString() }, solo.id);
    await createDeal({ title: 'Lost', status: 'lost', closed_at: new Date().toISOString(), lost_reason: 'x' }, solo.id);
    await createDeal({ title: 'Archived', status: 'archived' }, solo.id);
    const participantDeal = await createDeal({ title: 'Participant' }, contactId);
    const { data: participation } = await broker.db
      .from('opportunity_participants')
      .insert({ agency_id: broker.agencyId, opportunity_id: participantDeal, contact_id: solo.id, role: 'buyer' })
      .select('id')
      .single();
    cleanup.track('opportunity_participants', participation!.id);

    const deals = await inquiries.listJoinable(broker.agencyId, solo.id);

    expect(deals.map((d) => d.title).sort()).toEqual(['Active', 'Nurture', 'Participant']);
    expect(deals.find((d) => d.id === active)).toMatchObject({ stage_name: 'New', owner_name: expect.any(String), status: 'active' });
    expect(deals.find((d) => d.id === nurture)?.status).toBe('nurture');
  });

  it('offers the seeded repeat callers their open deals only', async () => {
    const { data: nina } = await broker.db
      .from('contacts')
      .select('id')
      .eq('agency_id', broker.agencyId)
      .eq('display_name', 'Nina Georgieva')
      .single();

    const deals = await inquiries.listJoinable(broker.agencyId, nina!.id);

    expect(deals.map((d) => [d.title, d.status])).toEqual([['Nina: 2-bedroom, on hold', 'nurture']]);
  });

  it('keeps another agency from listing or joining the deal', async () => {
    const dealId = await createDeal();
    const inquiry = await createInquiry();
    const outsider = await signInAs('broker@beta.bg');
    const outsiderInquiries = new InquiryService(outsider.db);

    expect(await outsiderInquiries.listJoinable(outsider.agencyId, contactId)).toEqual([]);
    await expect(
      outsiderInquiries.join(inquiry.id, outsider.agencyId, { contact_id: contactId, opportunity_id: dealId, task: null })
    ).rejects.toMatchObject({ code: 'errors.not_found' });
  });
});
