import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContactService } from '@/domain/contacts/service';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { TimelineService } from './service';

describeServices('TimelineService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let contactId: string;
  let otherContactId: string;
  let opportunityId: string;

  async function insert(table: string, values: Record<string, unknown>): Promise<string> {
    const { data, error } = await broker.db
      .from(table)
      .insert({ agency_id: broker.agencyId, ...values })
      .select('id')
      .single();
    if (error) throw new Error(`Could not insert into ${table}: ${error.message}`);
    cleanup.track(table, data.id);
    return data.id;
  }

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    const contacts = new ContactService(broker.db);
    const contact = await contacts.create(broker.agencyId, broker.userId, { type: 'person', first_name: 'Timeline' });
    const other = await contacts.create(broker.agencyId, broker.userId, { type: 'person', first_name: 'Other' });
    contactId = contact.id;
    otherContactId = other.id;
    cleanup.track('contacts', contactId);
    cleanup.track('contacts', otherContactId);

    const { data: stage } = await broker.db
      .from('stages')
      .select('id')
      .eq('agency_id', broker.agencyId)
      .eq('name', 'New')
      .single();
    opportunityId = await insert('opportunities', {
      title: 'Timeline deal',
      type: 'buyer',
      stage_id: stage!.id,
      primary_contact_id: contactId,
      assigned_to: broker.userId,
    });
  });

  afterAll(() => cleanup.run());

  const noteContents = (entries: Awaited<ReturnType<TimelineService['getContactTimeline']>>) =>
    entries.flatMap((entry) => (entry.type === 'note' ? [entry.data.content] : []));

  it("collects a contact's notes, including those on their deals, newest first", async () => {
    await insert('notes', { contact_id: contactId, content: 'On the contact', created_by: broker.userId });
    await insert('notes', { opportunity_id: opportunityId, content: 'On the deal', created_by: broker.userId });
    await insert('notes', { contact_id: otherContactId, content: 'On someone else', created_by: broker.userId });

    const entries = await new TimelineService(broker.db).getContactTimeline(contactId, broker.agencyId);

    expect(noteContents(entries).sort()).toEqual(['On the contact', 'On the deal']);
    const timestamps = entries.map((entry) => new Date(entry.timestamp).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("resolves a note's author from their profile", async () => {
    await insert('notes', { opportunity_id: opportunityId, content: 'With an author', created_by: broker.userId });

    const entries = await new TimelineService(broker.db).getOpportunityTimeline(opportunityId, broker.agencyId);

    const note = entries.find((entry) => entry.type === 'note');
    expect(note?.type === 'note' && note.data.author?.id).toBe(broker.userId);
  });

  it('shows another agency nothing', async () => {
    const outsider = await signInAs('broker@beta.bg');

    const entries = await new TimelineService(outsider.db).getContactTimeline(contactId, broker.agencyId);

    expect(entries).toEqual([]);
  });
});
