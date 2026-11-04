import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { ContactService } from '@/domain/contacts/service';
import { OpportunityService } from '@/domain/opportunities/service';
import type { OpportunityType } from '@/domain/opportunities/types';
import { PropertyPartyService } from '@/domain/property-parties/service';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { OpportunityPropertyService } from './service';

/** The subject property of seller and landlord deals (spec: properties, rule 5, AC-4). */
describeServices('Subject properties against the local stack', () => {
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

  async function createDeal(type: OpportunityType, primaryContactId: string | null = null) {
    const opportunity = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: `Subject ${type}`,
      type,
      stage_id: stageId,
      assigned_to: broker.userId,
      primary_contact_id: primaryContactId,
    });
    cleanup.track('opportunities', opportunity.id);
    return opportunity;
  }

  async function createProperty() {
    const property = await properties.create(broker.agencyId, broker.userId, { type: 'garage', settlement_id: sofiaId });
    cleanup.track('properties', property.id);
    return property;
  }

  async function setSubject(opportunityId: string, propertyId: string) {
    const link = await links.setSubject(broker.agencyId, broker.userId, { opportunity_id: opportunityId, property_id: propertyId });
    cleanup.track('opportunity_properties', link.id);
    return link;
  }

  it('links one subject property to a seller deal, without a status (AC-4)', async () => {
    const deal = await createDeal('seller');
    const property = await createProperty();
    await setSubject(deal.id, property.id);

    const [link] = await links.listForOpportunity(deal.id, broker.agencyId, 'bg');
    expect(link).toMatchObject({ relation: 'subject', status: null, property_id: property.id });

    await expect(setSubject(deal.id, (await createProperty()).id)).rejects.toEqual(
      new DomainError('opportunityProperties.errors.subjectExists'),
    );
  });

  it('refuses a subject on a buyer deal (AC-4)', async () => {
    const deal = await createDeal('buyer');
    await expect(setSubject(deal.id, (await createProperty()).id)).rejects.toEqual(
      new DomainError('properties.errors.relationNotAllowed'),
    );
  });

  it('creates a subject property with the primary contact as owner, linked to the deal', async () => {
    const contact = await new ContactService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'person',
      first_name: `Seller${crypto.randomUUID().slice(0, 6)}`,
    });
    cleanup.track('contacts', contact.id);
    const deal = await createDeal('landlord', contact.id);

    const property = await links.createSubjectProperty(broker.agencyId, broker.userId, deal.id, {
      type: 'apartment',
      rooms: 3,
      settlement_id: sofiaId,
    });
    cleanup.track('properties', property.id);

    const [link] = await links.listForOpportunity(deal.id, broker.agencyId, 'bg');
    cleanup.track('opportunity_properties', link.id);
    expect(link).toMatchObject({ relation: 'subject', property_id: property.id });

    const parties = await new PropertyPartyService(broker.db).listForProperty(property.id, broker.agencyId);
    parties.current.forEach((party) => cleanup.track('property_parties', party.id));
    expect(parties.current.map((party) => [party.contact.id, party.role])).toEqual([[contact.id, 'owner']]);
  });

  it('refuses before creating anything when the deal is a buyer deal or already has a subject', async () => {
    const buyer = await createDeal('buyer');
    await expect(
      links.createSubjectProperty(broker.agencyId, broker.userId, buyer.id, { type: 'garage', settlement_id: sofiaId }),
    ).rejects.toEqual(new DomainError('properties.errors.relationNotAllowed'));

    const seller = await createDeal('seller');
    await setSubject(seller.id, (await createProperty()).id);
    const address = `Не се създава ${crypto.randomUUID()}`;
    await expect(
      links.createSubjectProperty(broker.agencyId, broker.userId, seller.id, { type: 'garage', settlement_id: sofiaId, address }),
    ).rejects.toEqual(new DomainError('opportunityProperties.errors.subjectExists'));
    const { count } = await broker.db.from('properties').select('id', { count: 'exact', head: true }).eq('address', address);
    expect(count).toBe(0);
  });

  it("refuses another agency's deal as not found", async () => {
    const deal = await createDeal('seller');
    const outsider = await signInAs('broker@beta.bg');
    await expect(
      new OpportunityPropertyService(outsider.db).createSubjectProperty(outsider.agencyId, outsider.userId, deal.id, {
        type: 'garage',
        settlement_id: sofiaId,
      }),
    ).rejects.toEqual(new DomainError('errors.not_found'));
  });
});
