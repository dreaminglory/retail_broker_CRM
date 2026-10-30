import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { ContactMergeService } from './merge';
import { ContactService } from './service';

describeServices('ContactMergeService against the local stack', () => {
  const cleanup = createRowCleanup();
  let manager: TestSession;
  let contacts: ContactService;
  let merges: ContactMergeService;
  let stageId: string;

  beforeAll(async () => {
    manager = await signInAs('manager@alpha.bg');
    contacts = new ContactService(manager.db);
    merges = new ContactMergeService(manager.db);
    const { data: stage } = await manager.db
      .from('stages')
      .select('id')
      .eq('agency_id', manager.agencyId)
      .eq('name', 'New')
      .single();
    stageId = stage!.id;
  });

  afterAll(() => cleanup.run());

  async function createContact(firstName: string, phones: string[] = []) {
    const contact = await contacts.create(manager.agencyId, manager.userId, {
      type: 'person',
      first_name: firstName,
      contact_methods: phones.map((value) => ({ type: 'phone', value, label: null, is_primary: false })),
    });
    cleanup.track('contacts', contact.id);
    return contact;
  }

  async function insert(table: string, values: Record<string, unknown>): Promise<string> {
    const { data, error } = await manager.db
      .from(table)
      .insert({ agency_id: manager.agencyId, ...values })
      .select('id')
      .single();
    if (error) throw new Error(`Could not insert into ${table}: ${error.message}`);
    cleanup.track(table, data.id);
    return data.id;
  }

  const createOpportunity = (primaryContactId: string | null) =>
    insert('opportunities', {
      title: 'Merge deal',
      type: 'buyer',
      stage_id: stageId,
      primary_contact_id: primaryContactId,
      assigned_to: manager.userId,
    });

  it('moves everything to the winner, archives the loser and records the merge', async () => {
    const winner = await createContact('Winner', ['+359888000001']);
    const loser = await createContact('Loser', ['+359888000001', '+359888000002']);
    const opportunityId = await createOpportunity(loser.id);
    const inquiryId = await insert('inquiries', { contact_id: loser.id, status: 'new', caller_name: 'Loser' });
    const taskId = await insert('tasks', {
      contact_id: loser.id,
      assigned_to: manager.userId,
      title: 'Call the loser',
      due_at: new Date(Date.now() + 86_400_000).toISOString(),
      status: 'pending',
    });
    const movedParticipantId = await insert('opportunity_participants', {
      opportunity_id: opportunityId,
      contact_id: loser.id,
      role: 'buyer',
    });

    await merges.merge(manager.agencyId, winner.id, loser.id);

    const merged = await contacts.getById(winner.id, manager.agencyId);
    expect(merged!.contact_methods.map((method) => method.value).sort()).toEqual(['+359888000001', '+359888000002']);

    const after = async (table: string, id: string) =>
      (await manager.db.from(table).select('contact_id').eq('id', id).single()).data?.contact_id;
    expect(await after('inquiries', inquiryId)).toBe(winner.id);
    expect(await after('tasks', taskId)).toBe(winner.id);
    expect(await after('opportunity_participants', movedParticipantId)).toBe(winner.id);

    const { data: opportunity } = await manager.db
      .from('opportunities')
      .select('primary_contact_id')
      .eq('id', opportunityId)
      .single();
    expect(opportunity!.primary_contact_id).toBe(winner.id);

    expect((await contacts.getById(loser.id, manager.agencyId))!.status).toBe('archived');

    const { data: history } = await manager.db
      .from('merge_history')
      .select('winner_contact_id, merged_by, loser_snapshot')
      .eq('loser_contact_id', loser.id)
      .single();
    expect(history).toMatchObject({
      winner_contact_id: winner.id,
      merged_by: manager.userId,
      loser_snapshot: { id: loser.id, first_name: 'Loser' },
    });
  });

  it('drops the loser from a deal the winner is already on', async () => {
    const winner = await createContact('Both Winner');
    const loser = await createContact('Both Loser');
    const opportunityId = await createOpportunity(null);
    const winnerRowId = await insert('opportunity_participants', {
      opportunity_id: opportunityId,
      contact_id: winner.id,
      role: 'buyer',
    });
    await insert('opportunity_participants', { opportunity_id: opportunityId, contact_id: loser.id, role: 'buyer' });

    await merges.merge(manager.agencyId, winner.id, loser.id);

    const { data: participants } = await manager.db
      .from('opportunity_participants')
      .select('id, contact_id')
      .eq('opportunity_id', opportunityId);
    expect(participants).toEqual([{ id: winnerRowId, contact_id: winner.id }]);
  });

  it('previews what would move, without moving it', async () => {
    const winner = await createContact('Preview Winner', ['+359888000003']);
    const loser = await createContact('Preview Loser', ['+359888000003', '+359888000004']);
    const opportunityId = await createOpportunity(loser.id);

    const preview = await merges.getPreview(manager.agencyId, winner.id, loser.id);

    expect(preview).toMatchObject({ opportunitiesToTransfer: 1, contactMethodsToTransfer: 1 });
    const { data: opportunity } = await manager.db
      .from('opportunities')
      .select('primary_contact_id')
      .eq('id', opportunityId)
      .single();
    expect(opportunity!.primary_contact_id).toBe(loser.id);
  });

  it('refuses a broker, and moves nothing', async () => {
    const winner = await createContact('Broker Winner');
    const loser = await createContact('Broker Loser');
    const broker = await signInAs('broker@alpha.bg');

    await expect(
      new ContactMergeService(broker.db).merge(broker.agencyId, winner.id, loser.id)
    ).rejects.toMatchObject({ code: 'errors.forbidden' });
    expect((await contacts.getById(loser.id, manager.agencyId))!.status).toBe('active');
  });

  it('refuses to merge a contact with itself', async () => {
    const contact = await createContact('Self');

    await expect(merges.merge(manager.agencyId, contact.id, contact.id)).rejects.toMatchObject({
      code: 'errors.merge_self',
    });
  });

  it('refuses a contact from another agency', async () => {
    const winner = await createContact('Local');
    const outsider = await signInAs('manager@beta.bg');
    const foreign = await new ContactService(outsider.db).create(outsider.agencyId, outsider.userId, {
      type: 'person',
      first_name: 'Foreign',
    });
    cleanup.track('contacts', foreign.id);

    await expect(merges.merge(manager.agencyId, winner.id, foreign.id)).rejects.toMatchObject({
      code: 'errors.not_found',
    });
    expect((await new ContactService(outsider.db).getById(foreign.id, outsider.agencyId))!.status).toBe('active');
  });
});
