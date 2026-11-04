import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { ListingService } from '@/domain/listings/service';
import { OpportunityService } from '@/domain/opportunities/service';
import { OpportunityPropertyService } from '@/domain/opportunity-properties/service';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { TaskService } from '@/domain/tasks/service';
import type { TimelineEntry } from './types';
import { TimelineService } from './service';

/** The property timeline (AC-5) and the link change on the opportunity timeline. */
describeServices('Property timeline against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let propertyId: string;
  let otherPropertyId: string;
  let opportunityId: string;
  let linkId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    const { data: stage } = await broker.db.from('stages').select('id').eq('agency_id', broker.agencyId).eq('name', 'New').single();
    const [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
    const properties = new PropertyService(broker.db);

    const property = await properties.create(broker.agencyId, broker.userId, { type: 'apartment', rooms: 2, settlement_id: sofiaId });
    propertyId = property.id;
    cleanup.track('properties', propertyId);
    const other = await properties.create(broker.agencyId, broker.userId, { type: 'garage', settlement_id: sofiaId });
    otherPropertyId = other.id;
    cleanup.track('properties', otherPropertyId);

    const opportunity = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: 'Timeline buyer',
      type: 'buyer',
      stage_id: stage!.id,
      assigned_to: broker.userId,
    });
    opportunityId = opportunity.id;
    cleanup.track('opportunities', opportunityId);

    const listings = new ListingService(broker.db);
    const listing = await listings.create(broker.agencyId, broker.userId, { property_id: propertyId, offer_type: 'sale', price: 185000 });
    cleanup.track('listings', listing.id);
    await listings.changePrice(listing.id, broker.agencyId, { price: 179000 });
    const otherListing = await listings.create(broker.agencyId, broker.userId, { property_id: otherPropertyId, offer_type: 'rent', price: 300 });
    cleanup.track('listings', otherListing.id);

    const links = new OpportunityPropertyService(broker.db);
    const link = await links.addCandidate(broker.agencyId, broker.userId, { opportunity_id: opportunityId, property_id: propertyId });
    linkId = link.id;
    cleanup.track('opportunity_properties', linkId);
    await links.setStatus(linkId, broker.agencyId, { status: 'offered' });

    const task = await new TaskService(broker.db, { timezone: 'Europe/Sofia' }).create(broker.agencyId, broker.userId, {
      title: 'Viewing #timeline',
      task_type: 'viewing',
      opportunity_id: opportunityId,
      property_id: propertyId,
    });
    cleanup.track('tasks', task.id);
  });

  afterAll(() => cleanup.run());

  function describeEntry(entry: TimelineEntry): string {
    if (entry.type === 'task') return `task:${entry.data.title}`;
    if (entry.type === 'audit') {
      const { entity_type, action, field_name, old_value, new_value } = entry.data;
      return [entity_type, action, field_name, old_value, new_value].filter(Boolean).join(':');
    }
    return entry.type;
  }

  it('shows creation, the price change, the link change and the viewing, newest first (AC-5)', async () => {
    const entries = await new TimelineService(broker.db).getPropertyTimeline(propertyId, broker.agencyId);
    const events = entries.map(describeEntry);

    const expected = [
      'task:Viewing #timeline',
      'opportunity:status_change:property_link:candidate:offered',
      'listing:field_change:price:185000.00:179000.00',
      'property:created',
    ];
    expected.forEach((event) => expect(events).toContain(event));
    const positions = expected.map((event) => events.indexOf(event));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('names the deal on a link change', async () => {
    const entries = await new TimelineService(broker.db).getPropertyTimeline(propertyId, broker.agencyId);

    const change = entries.find((entry) => entry.type === 'audit' && entry.data.field_name === 'property_link');
    expect(change?.type === 'audit' && change.data.opportunity).toEqual({ id: opportunityId, title: 'Timeline buyer' });
  });

  it("leaves out another property's listing rows", async () => {
    const entries = await new TimelineService(broker.db).getPropertyTimeline(propertyId, broker.agencyId);

    const listingRows = entries.filter((entry) => entry.type === 'audit' && entry.data.entity_type === 'listing');
    expect(listingRows.every((entry) => entry.type === 'audit' && entry.data.metadata?.property_id === propertyId)).toBe(true);
    expect(listingRows.length).toBe(2);
  });

  it('shows the link change once on the opportunity timeline, with the property code', async () => {
    const entries = await new TimelineService(broker.db).getOpportunityTimeline(opportunityId, broker.agencyId);

    const changes = entries.filter(
      (entry) => entry.type === 'audit' && entry.data.field_name === 'property_link' && entry.data.new_value === 'offered'
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].type === 'audit' && changes[0].data.metadata?.property_id).toBe(propertyId);
    expect(changes[0].type === 'audit' && typeof changes[0].data.metadata?.property_code).toBe('number');
  });

  it('shows another agency nothing', async () => {
    const outsider = await signInAs('broker@beta.bg');

    const entries = await new TimelineService(outsider.db).getPropertyTimeline(propertyId, broker.agencyId);

    expect(entries).toEqual([]);
  });
});
