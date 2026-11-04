import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { ListingService } from './service';

describeServices('ListingService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let listings: ListingService;
  let sofiaId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    listings = new ListingService(broker.db);
    [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  async function createProperty() {
    const property = await new PropertyService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'apartment',
      rooms: 2,
      area_m2: 68,
      settlement_id: sofiaId,
    });
    cleanup.track('properties', property.id);
    return property;
  }

  it('keeps both prices in the audit log when the price changes (AC-5)', async () => {
    const property = await createProperty();
    const listing = await listings.create(broker.agencyId, broker.userId, {
      property_id: property.id,
      offer_type: 'sale',
      price: 185000,
    });
    const updated = await listings.changePrice(listing.id, broker.agencyId, { price: 179000 });
    expect(updated.price).toBe(179000);

    const { data: audit } = await broker.db
      .from('audit_log')
      .select('action, field_name, old_value, new_value')
      .eq('entity_type', 'listing')
      .eq('entity_id', listing.id)
      .order('performed_at', { ascending: true });
    expect(audit).toEqual([
      { action: 'created', field_name: null, old_value: null, new_value: '185000.00' },
      { action: 'field_change', field_name: 'price', old_value: '185000.00', new_value: '179000.00' },
    ]);
  });

  it('refuses a second open sale listing but allows an open rent one beside it', async () => {
    const property = await createProperty();
    await listings.create(broker.agencyId, broker.userId, { property_id: property.id, offer_type: 'sale', price: 185000 });

    await expect(
      listings.create(broker.agencyId, broker.userId, { property_id: property.id, offer_type: 'sale', price: 190000 }),
    ).rejects.toEqual(new DomainError('listings.errors.openExists'));

    const rent = await listings.create(broker.agencyId, broker.userId, { property_id: property.id, offer_type: 'rent', price: 900 });
    expect(rent.status).toBe('active');
    expect((await listings.listForProperty(property.id, broker.agencyId)).map((row) => row.offer_type).sort()).toEqual([
      'rent',
      'sale',
    ]);
  });

  it('reserves and reopens, then makes a closed listing read-only (rule 4)', async () => {
    const property = await createProperty();
    const listing = await listings.create(broker.agencyId, broker.userId, { property_id: property.id, offer_type: 'sale', price: 185000 });

    expect((await listings.setStatus(listing.id, broker.agencyId, { status: 'reserved' })).status).toBe('reserved');
    expect((await listings.setStatus(listing.id, broker.agencyId, { status: 'active' })).status).toBe('active');
    const closed = await listings.setStatus(listing.id, broker.agencyId, { status: 'closed' });
    expect(closed.closed_at).not.toBeNull();

    await expect(listings.changePrice(listing.id, broker.agencyId, { price: 170000 })).rejects.toEqual(
      new DomainError('listings.errors.readOnly'),
    );
    await expect(listings.setStatus(listing.id, broker.agencyId, { status: 'active' })).rejects.toEqual(
      new DomainError('listings.errors.readOnly'),
    );

    // A new listing can be opened after the old one closed.
    await listings.create(broker.agencyId, broker.userId, { property_id: property.id, offer_type: 'sale', price: 175000 });
  });

  it("refuses a listing on an archived property, and on another agency's property", async () => {
    const property = await createProperty();
    await broker.db.from('properties').update({ status: 'archived' }).eq('id', property.id);
    await expect(
      listings.create(broker.agencyId, broker.userId, { property_id: property.id, offer_type: 'rent', price: 900 }),
    ).rejects.toEqual(new DomainError('properties.errors.archived'));

    const outsider = await signInAs('broker@beta.bg');
    const active = await createProperty();
    await expect(
      new ListingService(outsider.db).create(outsider.agencyId, outsider.userId, {
        property_id: active.id,
        offer_type: 'sale',
        price: 100000,
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(await new ListingService(outsider.db).listForProperty(active.id, outsider.agencyId)).toEqual([]);
  });
});
