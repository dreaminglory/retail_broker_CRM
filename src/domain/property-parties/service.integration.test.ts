import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { ContactService } from '@/domain/contacts/service';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { PropertyPartyService } from './service';

describeServices('PropertyPartyService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let parties: PropertyPartyService;
  let sofiaId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    parties = new PropertyPartyService(broker.db);
    [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  async function createProperty() {
    const property = await new PropertyService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'garage',
      settlement_id: sofiaId,
    });
    cleanup.track('properties', property.id);
    return property;
  }

  async function createContact(name: string) {
    const contact = await new ContactService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'person',
      first_name: `${name}${crypto.randomUUID().slice(0, 6)}`,
    });
    cleanup.track('contacts', contact.id);
    return contact;
  }

  it('adds an owner and a co-owner; ending the owner keeps it as a past party', async () => {
    const property = await createProperty();
    const owner = await createContact('Owner');
    const coOwner = await createContact('CoOwner');

    const ownerParty = await parties.add(broker.agencyId, broker.userId, { property_id: property.id, contact_id: owner.id, role: 'owner' });
    await parties.add(broker.agencyId, broker.userId, { property_id: property.id, contact_id: coOwner.id, role: 'co_owner' });
    await parties.end(ownerParty.id, broker.agencyId);

    const listed = await parties.listForProperty(property.id, broker.agencyId);
    expect(listed.current.map((party) => [party.contact.display_name, party.role])).toEqual([[coOwner.display_name, 'co_owner']]);
    expect(listed.past.map((party) => party.contact.id)).toEqual([owner.id]);
    expect(listed.past[0].ended_at).not.toBeNull();
  });

  it('refuses the same open contact twice, and lets an ended one come back', async () => {
    const property = await createProperty();
    const owner = await createContact('Twice');
    const first = await parties.add(broker.agencyId, broker.userId, { property_id: property.id, contact_id: owner.id, role: 'owner' });

    await expect(
      parties.add(broker.agencyId, broker.userId, { property_id: property.id, contact_id: owner.id, role: 'representative' }),
    ).rejects.toEqual(new DomainError('propertyParties.errors.alreadyParty'));

    await parties.end(first.id, broker.agencyId);
    await expect(parties.end(first.id, broker.agencyId)).rejects.toEqual(new DomainError('propertyParties.errors.alreadyEnded'));
    await parties.add(broker.agencyId, broker.userId, { property_id: property.id, contact_id: owner.id, role: 'owner' });
  });

  it('lists the properties of a contact with role and status, in the locale', async () => {
    const property = await createProperty();
    const owner = await createContact('Listed');
    await parties.add(broker.agencyId, broker.userId, { property_id: property.id, contact_id: owner.id, role: 'owner' });

    const rows = await parties.listForContact(owner.id, broker.agencyId, 'en');
    expect(rows).toEqual([
      expect.objectContaining({
        role: 'owner',
        ended_at: null,
        property: expect.objectContaining({ id: property.id, code: property.code, status: 'active', settlement_name: 'Sofia' }),
      }),
    ]);
  });

  it("keeps another agency's parties out", async () => {
    const property = await createProperty();
    const owner = await createContact('Hidden');
    await parties.add(broker.agencyId, broker.userId, { property_id: property.id, contact_id: owner.id, role: 'owner' });

    const outsider = await signInAs('broker@beta.bg');
    const theirs = new PropertyPartyService(outsider.db);
    expect(await theirs.listForProperty(property.id, outsider.agencyId)).toEqual({ current: [], past: [] });
    expect(await theirs.listForContact(owner.id, outsider.agencyId, 'bg')).toEqual([]);
  });
});
