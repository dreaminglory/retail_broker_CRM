import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { OpportunityService } from '@/domain/opportunities/service';
import { OpportunityPropertyService } from '@/domain/opportunity-properties/service';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { TaskService } from './service';

/** Rule 7 through the task service: completing a viewing marks its property viewed (AC-3). */
describeServices('Viewing tasks with a property against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let tasks: TaskService;
  let links: OpportunityPropertyService;
  let properties: PropertyService;
  let stageId: string;
  let sofiaId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    tasks = new TaskService(broker.db, { timezone: 'Europe/Sofia' });
    links = new OpportunityPropertyService(broker.db);
    properties = new PropertyService(broker.db);
    const { data: stage } = await broker.db.from('stages').select('id').eq('agency_id', broker.agencyId).eq('name', 'New').single();
    stageId = stage!.id;
    [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  async function createBuyerDeal() {
    const opportunity = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: 'Viewing deal',
      type: 'buyer',
      stage_id: stageId,
      assigned_to: broker.userId,
    });
    cleanup.track('opportunities', opportunity.id);
    return opportunity;
  }

  async function createProperty(address?: string) {
    const property = await properties.create(broker.agencyId, broker.userId, { type: 'garage', settlement_id: sofiaId, address });
    cleanup.track('properties', property.id);
    return property;
  }

  async function linkCandidate(opportunityId: string, propertyId: string) {
    const link = await links.addCandidate(broker.agencyId, broker.userId, { opportunity_id: opportunityId, property_id: propertyId });
    cleanup.track('opportunity_properties', link.id);
    return link;
  }

  async function scheduleViewing(opportunityId: string, propertyId: string) {
    const task = await tasks.create(broker.agencyId, broker.userId, {
      title: 'Viewing',
      task_type: 'viewing',
      opportunity_id: opportunityId,
      property_id: propertyId,
    });
    cleanup.track('tasks', task.id);
    return task;
  }

  /** Link status per property; tracks links the trigger created so they are cleaned up. */
  async function statuses(opportunityId: string) {
    const rows = await links.listForOpportunity(opportunityId, broker.agencyId, 'bg');
    rows.forEach((row) => cleanup.track('opportunity_properties', row.id));
    return Object.fromEntries(rows.map((row) => [row.property_id, row.status]));
  }

  it('moves candidate A to viewed and leaves B alone (AC-3)', async () => {
    const deal = await createBuyerDeal();
    const [a, b] = [await createProperty(), await createProperty()];
    await linkCandidate(deal.id, a.id);
    await linkCandidate(deal.id, b.id);

    const viewing = await scheduleViewing(deal.id, a.id);
    expect(viewing.property_id).toBe(a.id);
    await tasks.completeWithNext(viewing.id, broker.agencyId, broker.userId, { outcome: 'They liked the kitchen' });

    expect(await statuses(deal.id)).toEqual({ [a.id]: 'viewed', [b.id]: 'candidate' });
  });

  it('leaves an offered link offered, and creates a missing link as viewed (AC-3)', async () => {
    const deal = await createBuyerDeal();
    const offered = await createProperty();
    const unlinked = await createProperty();
    const link = await linkCandidate(deal.id, offered.id);
    await links.setStatus(link.id, broker.agencyId, { status: 'offered' });

    for (const property of [offered, unlinked]) {
      const viewing = await scheduleViewing(deal.id, property.id);
      await tasks.completeWithNext(viewing.id, broker.agencyId, broker.userId, { outcome: 'Done' });
    }

    expect(await statuses(deal.id)).toEqual({ [offered.id]: 'offered', [unlinked.id]: 'viewed' });
  });

  it('schedules the next task as a viewing of a property', async () => {
    const deal = await createBuyerDeal();
    const property = await createProperty();
    const call = await tasks.create(broker.agencyId, broker.userId, { title: 'Call', task_type: 'call', opportunity_id: deal.id });
    cleanup.track('tasks', call.id);

    const { nextTask } = await tasks.completeWithNext(call.id, broker.agencyId, broker.userId, {
      outcome: 'Wants to see it',
      next_task: { title: 'Viewing', task_type: 'viewing', opportunity_id: deal.id, property_id: property.id },
    });
    cleanup.track('tasks', nextTask?.id);
    expect(nextTask).toMatchObject({ task_type: 'viewing', property_id: property.id });
  });

  it('refuses a viewing of an archived property with a translated key', async () => {
    const deal = await createBuyerDeal();
    const property = await createProperty();
    await properties.setArchived(property.id, broker.agencyId, true);

    await expect(scheduleViewing(deal.id, property.id)).rejects.toEqual(new DomainError('properties.errors.archived'));
  });

  it('lists tasks with their property code and address', async () => {
    const deal = await createBuyerDeal();
    const property = await createProperty('ул. Огледна 3');
    await scheduleViewing(deal.id, property.id);

    const [listed] = await tasks.list(broker.agencyId, { opportunityId: deal.id });
    expect(listed.property).toEqual({ id: property.id, code: property.code, address: 'ул. Огледна 3' });
  });
});
