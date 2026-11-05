import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContactService } from '@/domain/contacts/service';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { RequirementService } from '@/domain/requirements/service';
import { SettlementService } from '@/domain/settlements/service';
import { describeAudit } from './audit-event';
import { TimelineService } from './service';
import type { TimelineEntry } from './types';

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

  it('shows one entry per requirement save on the deal and on its contact (AC-2, AD-059)', async () => {
    const [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
    const lozenets = { settlement_id: sofiaId, area_id: '11111111-8888-0000-0000-000000000001' };
    const mladost = { settlement_id: sofiaId, area_id: '11111111-8888-0000-0000-000000000002' };
    const requirements = new RequirementService(broker.db);
    const ac1 = { budget_min: 150_000, budget_max: 200_000, budget_must: true, locations: [lozenets] };

    await requirements.save(broker.agencyId, opportunityId, ac1);
    await requirements.save(broker.agencyId, opportunityId, { ...ac1, budget_max: 220_000, locations: [lozenets, mladost] });
    await requirements.save(broker.agencyId, opportunityId, { ...ac1, budget_max: 220_000, locations: [lozenets, mladost] });
    await requirements.remove(broker.agencyId, opportunityId);

    const timeline = new TimelineService(broker.db);
    const requirementEvents = (entries: TimelineEntry[]) =>
      entries.flatMap((entry) => {
        if (entry.type !== 'audit') return [];
        const event = describeAudit(entry.data);
        return event.kind === 'requirement' ? [{ event, author: entry.data.author?.id }] : [];
      });

    const onDeal = requirementEvents(await timeline.getOpportunityTimeline(opportunityId, broker.agencyId));
    const onContact = requirementEvents(await timeline.getContactTimeline(contactId, broker.agencyId));

    // Newest first; the save that changed nothing wrote nothing.
    expect(onDeal.map(({ event }) => event.event)).toEqual(['removed', 'changed', 'created']);
    expect(onDeal[1].event.changes).toEqual([
      { field: 'budget_max', from: 200000, to: 220000 },
      {
        field: 'locations',
        from: [{ settlementBg: 'София', settlementEn: 'Sofia', area: 'Лозенец' }],
        to: [
          { settlementBg: 'София', settlementEn: 'Sofia', area: 'Лозенец' },
          { settlementBg: 'София', settlementEn: 'Sofia', area: 'Младост 1' },
        ],
      },
    ]);
    expect(onDeal.every(({ author }) => author === broker.userId)).toBe(true);
    expect(onContact.map(({ event }) => event.event)).toEqual(['removed', 'changed', 'created']);
  });
});
