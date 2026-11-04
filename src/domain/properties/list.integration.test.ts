import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { AreaService } from '@/domain/areas/service';
import { ListingService } from '@/domain/listings/service';
import { SettlementService } from '@/domain/settlements/service';
import type { PropertyListFilters } from './list-filters';
import { PropertyService } from './service';

describeServices('PropertyService list filters against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let properties: PropertyService;
  let areaId: string;
  const ids: Record<'saleAndRent' | 'noListing' | 'expensive' | 'archived' | 'studio', string> = {
    saleAndRent: '',
    noListing: '',
    expensive: '',
    archived: '',
    studio: '',
  };

  beforeAll(async () => {
    // Every case filters by an area of its own, so the seed and other suites don't count.
    const owner = await signInAs('owner@alpha.bg');
    const [sofia] = await new SettlementService(owner.db).search('София', 'bg');
    const area = await new AreaService(owner.db).create(owner.agencyId, {
      settlement_id: sofia.id,
      name: `Списък ${crypto.randomUUID().slice(0, 8)}`,
    });
    cleanup.track('areas', area.id);
    areaId = area.id;

    broker = await signInAs('broker@alpha.bg');
    properties = new PropertyService(broker.db);
    const listings = new ListingService(broker.db);

    async function create(key: keyof typeof ids, type: 'apartment' | 'studio', rooms: number | null) {
      const property = await properties.create(broker.agencyId, broker.userId, {
        type,
        rooms,
        area_m2: 68,
        settlement_id: sofia.id,
        area_id: areaId,
      });
      cleanup.track('properties', property.id);
      ids[key] = property.id;
      return property;
    }

    const saleAndRent = await create('saleAndRent', 'apartment', 2);
    await listings.create(broker.agencyId, broker.userId, { property_id: saleAndRent.id, offer_type: 'sale', price: 185000 });
    await listings.create(broker.agencyId, broker.userId, { property_id: saleAndRent.id, offer_type: 'rent', price: 900 });
    await create('noListing', 'apartment', 3);
    const expensive = await create('expensive', 'apartment', 3);
    await listings.create(broker.agencyId, broker.userId, { property_id: expensive.id, offer_type: 'sale', price: 250000 });
    const archived = await create('archived', 'apartment', 2);
    await broker.db.from('properties').update({ status: 'archived' }).eq('id', archived.id);
    const studio = await create('studio', 'studio', null);
    const closed = await listings.create(broker.agencyId, broker.userId, { property_id: studio.id, offer_type: 'sale', price: 160000 });
    await listings.setStatus(closed.id, broker.agencyId, { status: 'closed' });
  });

  afterAll(() => cleanup.run());

  async function list(filters: Partial<PropertyListFilters>) {
    const page = await properties.listPage(broker.agencyId, { status: 'active', areaId, ...filters }, 'bg', { limit: 50, offset: 0 });
    return { ids: page.rows.map((row) => row.id).sort(), total: page.total, rows: page.rows };
  }

  it('lists properties with and without listings, hiding archived ones by default', async () => {
    const result = await list({});
    expect(result.ids).toEqual([ids.saleAndRent, ids.noListing, ids.expensive, ids.studio].sort());
    expect(result.total).toBe(4);
  });

  it('finds the AC-1 property by area and price range, once (AC-1)', async () => {
    const result = await list({ priceMin: 150000, priceMax: 200000 });
    expect(result.ids).toEqual([ids.saleAndRent]);
    expect(result.total).toBe(1);
    // The row still shows both of its open listings.
    expect(result.rows[0].open_listings.map((listing) => listing.offer_type).sort()).toEqual(['rent', 'sale']);
  });

  it('shows a property with two listings once under an offer type filter', async () => {
    expect((await list({ offerType: 'sale' })).ids).toEqual([ids.saleAndRent, ids.expensive].sort());
    expect((await list({ offerType: 'rent' })).ids).toEqual([ids.saleAndRent]);
  });

  it('matches closed listings only when that status is asked for', async () => {
    expect((await list({ priceMax: 170000, offerType: 'sale' })).ids).toEqual([]);
    expect((await list({ listingStatus: 'closed' })).ids).toEqual([ids.studio]);
  });

  it('filters by type and rooms, and shows archived ones on request', async () => {
    expect((await list({ type: 'studio' })).ids).toEqual([ids.studio]);
    expect((await list({ rooms: 3 })).ids).toEqual([ids.noListing, ids.expensive].sort());
    expect((await list({ status: 'archived' })).ids).toEqual([ids.archived]);
    expect((await list({ status: 'all' })).total).toBe(5);
  });

  it('pages without losing or repeating rows', async () => {
    const first = await properties.listPage(broker.agencyId, { status: 'active', areaId }, 'bg', { limit: 3, offset: 0 });
    const second = await properties.listPage(broker.agencyId, { status: 'active', areaId }, 'bg', { limit: 3, offset: 3 });
    expect(first.total).toBe(4);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(4);
  });

  it("returns nothing of another agency's", async () => {
    const outsider = await signInAs('broker@beta.bg');
    const theirs = await new PropertyService(outsider.db).listPage(outsider.agencyId, { status: 'all', areaId }, 'bg', {
      limit: 50,
      offset: 0,
    });
    expect(theirs).toMatchObject({ rows: [], total: 0 });
  });
});
