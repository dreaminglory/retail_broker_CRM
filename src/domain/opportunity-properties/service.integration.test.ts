import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { OpportunityService } from '@/domain/opportunities/service';
import type { OpportunityType } from '@/domain/opportunities/types';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { OpportunityPropertyService } from './service';

describeServices('OpportunityPropertyService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let links: OpportunityPropertyService;
  let properties: PropertyService;
  let stageId: string;
  let sofiaId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    links = new OpportunityPropertyService(broker.db);
    properties = new PropertyService(broker.db);
    const { data: stage } = await broker.db.from('stages').select('id').eq('agency_id', broker.agencyId).eq('name', 'New').single();
    stageId = stage!.id;
    [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  async function createOpportunity(type: OpportunityType = 'buyer') {
    const opportunity = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: `Links ${type}`,
      type,
      stage_id: stageId,
      assigned_to: broker.userId,
    });
    cleanup.track('opportunities', opportunity.id);
    return opportunity;
  }

  async function createProperty(address = 'ул. Тестова 1') {
    const property = await properties.create(broker.agencyId, broker.userId, {
      type: 'apartment',
      rooms: 2,
      settlement_id: sofiaId,
      address,
    });
    cleanup.track('properties', property.id);
    return property;
  }

  async function addCandidate(input: { opportunity_id: string; property_id: string }) {
    const link = await links.addCandidate(broker.agencyId, broker.userId, input);
    cleanup.track('opportunity_properties', link.id);
    return link;
  }

  it('adds two candidates and moves one to offered; both sides list it (AC-2)', async () => {
    const opportunity = await createOpportunity();
    const a = await createProperty();
    const b = await createProperty();

    const linkA = await addCandidate({ opportunity_id: opportunity.id, property_id: a.id });
    await addCandidate({ opportunity_id: opportunity.id, property_id: b.id });
    await links.setStatus(linkA.id, broker.agencyId, { status: 'offered' });

    const onOpportunity = await links.listForOpportunity(opportunity.id, broker.agencyId, 'en');
    expect(onOpportunity.map((link) => [link.property.code, link.status])).toEqual([
      [a.code, 'offered'],
      [b.code, 'candidate'],
    ]);
    expect(onOpportunity[0].property).toMatchObject({ settlement_name: 'Sofia', address: 'ул. Тестова 1', status: 'active' });

    const onProperty = await links.listForProperty(a.id, broker.agencyId);
    expect(onProperty).toEqual([
      expect.objectContaining({
        status: 'offered',
        opportunity: expect.objectContaining({ id: opportunity.id, title: opportunity.title, type: 'buyer' }),
      }),
    ]);
  });

  it('audits each status change as one property_link row', async () => {
    const opportunity = await createOpportunity();
    const property = await createProperty();
    const link = await addCandidate({ opportunity_id: opportunity.id, property_id: property.id });
    await links.setStatus(link.id, broker.agencyId, { status: 'rejected', rejected_reason: 'Too dark' });

    const { data } = await broker.db
      .from('audit_log')
      .select('old_value, new_value, metadata')
      .eq('entity_id', opportunity.id)
      .eq('field_name', 'property_link')
      .order('performed_at');
    expect(data?.map((row) => [row.old_value, row.new_value])).toEqual([
      [null, 'candidate'],
      ['candidate', 'rejected'],
    ]);
    expect(data?.[1].metadata).toMatchObject({ property_id: property.id, rejected_reason: 'Too dark' });
  });

  it('refuses a second selected candidate with a translated key (AC-4)', async () => {
    const opportunity = await createOpportunity('tenant');
    const a = await addCandidate({ opportunity_id: opportunity.id, property_id: (await createProperty()).id });
    const b = await addCandidate({ opportunity_id: opportunity.id, property_id: (await createProperty()).id });
    await links.setStatus(a.id, broker.agencyId, { status: 'selected' });

    await expect(links.setStatus(b.id, broker.agencyId, { status: 'selected' })).rejects.toEqual(
      new DomainError('opportunityProperties.errors.alreadySelected'),
    );
  });

  it('refuses the same property twice, a candidate on a seller deal and an archived property', async () => {
    const buyer = await createOpportunity();
    const property = await createProperty();
    await addCandidate({ opportunity_id: buyer.id, property_id: property.id });
    await expect(
      addCandidate({ opportunity_id: buyer.id, property_id: property.id }),
    ).rejects.toEqual(new DomainError('opportunityProperties.errors.alreadyLinked'));

    const seller = await createOpportunity('seller');
    await expect(
      addCandidate({ opportunity_id: seller.id, property_id: (await createProperty()).id }),
    ).rejects.toEqual(new DomainError('properties.errors.relationNotAllowed'));

    const archived = await createProperty();
    await properties.setArchived(archived.id, broker.agencyId, true);
    await expect(
      addCandidate({ opportunity_id: buyer.id, property_id: archived.id }),
    ).rejects.toEqual(new DomainError('properties.errors.archived'));
  });

  it('removes a candidate', async () => {
    const opportunity = await createOpportunity();
    const link = await addCandidate({ opportunity_id: opportunity.id, property_id: (await createProperty()).id });
    await links.remove(link.id, broker.agencyId);
    expect(await links.listForOpportunity(opportunity.id, broker.agencyId, 'bg')).toEqual([]);
    await expect(links.remove(link.id, broker.agencyId)).rejects.toEqual(new DomainError('errors.not_found'));
  });

  it('translates a buyer → seller type change while candidates exist', async () => {
    const opportunity = await createOpportunity();
    await addCandidate({ opportunity_id: opportunity.id, property_id: (await createProperty()).id });

    await expect(
      new OpportunityService(broker.db).update(opportunity.id, broker.agencyId, { type: 'seller' }),
    ).rejects.toEqual(new DomainError('opportunities.errors.typeHasProperties'));
  });

  it('finds active properties for the picker by code or address, never archived ones', async () => {
    const marker = `Пикер ${crypto.randomUUID().slice(0, 8)}`;
    const found = await createProperty(`${marker} 5`);
    const archived = await createProperty(`${marker} 7`);
    await properties.setArchived(archived.id, broker.agencyId, true);

    const byAddress = await properties.searchForPicker(broker.agencyId, marker, 'en');
    expect(byAddress.map((row) => row.id)).toEqual([found.id]);
    expect(byAddress[0]).toMatchObject({ code: found.code, settlement_name: 'Sofia' });

    const byCode = await properties.searchForPicker(broker.agencyId, `#${found.code}`, 'bg');
    expect(byCode.map((row) => row.id)).toContain(found.id);
  });

  it("keeps another agency's links out", async () => {
    const opportunity = await createOpportunity();
    const property = await createProperty();
    const link = await addCandidate({ opportunity_id: opportunity.id, property_id: property.id });

    const outsider = await signInAs('broker@beta.bg');
    const theirs = new OpportunityPropertyService(outsider.db);
    expect(await theirs.listForOpportunity(opportunity.id, outsider.agencyId, 'bg')).toEqual([]);
    expect(await theirs.listForProperty(property.id, outsider.agencyId)).toEqual([]);
    await expect(theirs.setStatus(link.id, outsider.agencyId, { status: 'viewed' })).rejects.toEqual(new DomainError('errors.not_found'));
    expect(await new PropertyService(outsider.db).searchForPicker(outsider.agencyId, `#${property.code}`, 'bg')).not.toContainEqual(
      expect.objectContaining({ id: property.id }),
    );
  });
});
