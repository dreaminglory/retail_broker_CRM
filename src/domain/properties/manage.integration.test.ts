import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { ListingService } from '@/domain/listings/service';
import { SettlementService } from '@/domain/settlements/service';
import { PropertyService } from './service';

/** Alpha Opp 1, the seeded buyer deal. */
const ALPHA_BUYER_OPPORTUNITY = '11111111-6666-6666-6666-666666666661';
const ALPHA_MANAGER = '11111111-3333-3333-3333-333333333333';

describeServices('PropertyService edit, archive and delete against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let manager: TestSession;
  let properties: PropertyService;
  let sofiaId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    manager = await signInAs('manager@alpha.bg');
    properties = new PropertyService(broker.db);
    [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  async function createProperty() {
    const property = await properties.create(broker.agencyId, broker.userId, {
      type: 'apartment',
      rooms: 2,
      area_m2: 68,
      settlement_id: sofiaId,
    });
    cleanup.track('properties', property.id);
    return property;
  }

  it('edits attributes, clearing what the new type does not have', async () => {
    const property = await createProperty();
    const updated = await properties.update(property.id, broker.agencyId, {
      type: 'plot',
      plot_m2: 600,
      rooms: 2,
      settlement_id: sofiaId,
      address: 'ул. Тестова 1',
    });
    expect(updated).toMatchObject({ type: 'plot', plot_m2: 600, rooms: null, area_m2: null, address: 'ул. Тестова 1' });
  });

  it('reassigns to an active member, audited, and refuses anyone else', async () => {
    const property = await createProperty();
    await properties.update(property.id, broker.agencyId, {
      type: 'apartment',
      rooms: 2,
      settlement_id: sofiaId,
      assigned_to: ALPHA_MANAGER,
    });

    const { data: audit } = await broker.db
      .from('audit_log')
      .select('action, old_value, new_value')
      .eq('entity_type', 'property')
      .eq('entity_id', property.id)
      .eq('action', 'assignment_change');
    expect(audit).toEqual([{ action: 'assignment_change', old_value: broker.userId, new_value: ALPHA_MANAGER }]);

    await expect(
      properties.update(property.id, broker.agencyId, {
        type: 'apartment',
        rooms: 2,
        settlement_id: sofiaId,
        assigned_to: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toEqual(new DomainError('properties.errors.assigneeNotMember'));
  });

  it('archives (withdrawing open listings) and unarchives, any member', async () => {
    const property = await createProperty();
    const listing = await new ListingService(broker.db).create(broker.agencyId, broker.userId, {
      property_id: property.id,
      offer_type: 'sale',
      price: 185000,
    });

    expect((await properties.setArchived(property.id, broker.agencyId, true)).status).toBe('archived');
    const [withdrawn] = await new ListingService(broker.db).listForProperty(property.id, broker.agencyId);
    expect(withdrawn).toMatchObject({ id: listing.id, status: 'withdrawn' });

    expect((await properties.setArchived(property.id, broker.agencyId, false)).status).toBe('active');
  });

  it('lets only an owner or manager delete, and refuses a property in use (rule 1)', async () => {
    const plain = await createProperty();
    await expect(properties.delete(plain.id, broker.agencyId)).rejects.toEqual(new DomainError('errors.forbidden'));

    const managed = new PropertyService(manager.db);
    const linked = await createProperty();
    const { data: link } = await broker.db
      .from('opportunity_properties')
      .insert({
        agency_id: broker.agencyId,
        opportunity_id: ALPHA_BUYER_OPPORTUNITY,
        property_id: linked.id,
        relation: 'candidate',
        status: 'candidate',
      })
      .select('id')
      .single();
    cleanup.track('opportunity_properties', link?.id);
    await expect(managed.delete(linked.id, manager.agencyId)).rejects.toEqual(new DomainError('properties.errors.inUse'));

    const listed = await createProperty();
    await new ListingService(broker.db).create(broker.agencyId, broker.userId, { property_id: listed.id, offer_type: 'rent', price: 900 });
    await expect(managed.delete(listed.id, manager.agencyId)).rejects.toEqual(new DomainError('properties.errors.inUse'));

    const withTask = await createProperty();
    const { data: task } = await broker.db
      .from('tasks')
      .insert({ agency_id: broker.agencyId, title: 'Оглед', property_id: withTask.id, opportunity_id: ALPHA_BUYER_OPPORTUNITY, assigned_to: broker.userId })
      .select('id')
      .single();
    cleanup.track('tasks', task?.id);
    await expect(managed.delete(withTask.id, manager.agencyId)).rejects.toEqual(new DomainError('properties.errors.inUse'));

    await managed.delete(plain.id, manager.agencyId);
    expect(await properties.getById(plain.id, broker.agencyId)).toBeNull();
  });
});
