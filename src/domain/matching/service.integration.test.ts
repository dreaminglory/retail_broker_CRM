import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { OpportunityService } from '@/domain/opportunities/service';
import type { OpportunityType } from '@/domain/opportunities/types';
import { RequirementService } from '@/domain/requirements/service';
import { ListingService } from '@/domain/listings/service';
import { OpportunityPropertyService } from '@/domain/opportunity-properties/service';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { MatchingService } from './service';

/** Seeded (supabase/seed.sql): Alpha buyer deal, the exact Lozenets apartment, an offered one, a reserved one. */
const ALPHA_OPP_1 = '11111111-6666-6666-6666-666666666661';
const EXACT_PROPERTY = '11111111-9999-0000-0000-000000000011';
const OFFERED_PROPERTY = '11111111-9999-0000-0000-000000000001';
const RESERVED_PROPERTY = '11111111-9999-0000-0000-000000000014';

describeServices('MatchingService against the local stack', () => {
  const cleanup = createRowCleanup();
  let alpha: TestSession;
  let matching: MatchingService;
  let stageId: string;
  let sofiaId: string;

  beforeAll(async () => {
    alpha = await signInAs('broker@alpha.bg');
    matching = new MatchingService(alpha.db);
    const { data: stage } = await alpha.db.from('stages').select('id').eq('agency_id', alpha.agencyId).eq('name', 'New').single();
    stageId = stage!.id;
    [{ id: sofiaId }] = await new SettlementService(alpha.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  async function createOpportunity(type: OpportunityType = 'buyer') {
    const opportunity = await new OpportunityService(alpha.db).create(alpha.agencyId, alpha.userId, {
      title: `Matching ${type}`,
      type,
      stage_id: stageId,
      assigned_to: alpha.userId,
    });
    cleanup.track('opportunities', opportunity.id);
    return opportunity;
  }

  const anyRequirement = () => ({
    budget_min: null,
    budget_max: 500_000,
    property_types: [],
    rooms_min: null,
    rooms_max: null,
    not_top_floor: false,
    construction: [],
    financing: 'unknown' as const,
    wishes: null,
    budget_must: false,
    location_must: false,
    type_must: false,
    locations: [{ settlement_id: sofiaId, area_id: null }],
  });

  describe('forOpportunity', () => {
    it('lists the new matches best first and reserved last, with the location named', async () => {
      const bg = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'bg');

      expect(bg.rows[0]).toMatchObject({ score: 100, listing_status: 'active', link_status: null, settlement_name: 'София' });
      expect(bg.rows[0].area_name).toBeTruthy();
      expect(bg.rows.map((row) => row.property_id)).not.toContain(OFFERED_PROPERTY);
      expect(bg.rows.find((row) => row.property_id === RESERVED_PROPERTY)).toBeDefined();
      const statuses = bg.rows.map((row) => row.listing_status);
      expect(statuses.lastIndexOf('active')).toBeLessThan(statuses.indexOf('reserved'));
      expect(bg.unlinked).toBe(bg.total);

    });

    // Own deal and own properties at a price no other suite uses, so concurrent suites that add
    // and remove links on the seeded deal cannot change these counts.
    describe('on a deal of its own', () => {
      const PRICE = 777_000;
      let dealId: string;
      let linkedId: string;
      const propertyIds: string[] = [];

      beforeAll(async () => {
        const opportunity = await createOpportunity();
        dealId = opportunity.id;
        await new RequirementService(alpha.db).save(alpha.agencyId, dealId, {
          ...anyRequirement(),
          budget_min: PRICE - 5_000,
          budget_max: PRICE + 5_000,
          budget_must: true,
        });
        const properties = new PropertyService(alpha.db);
        const listings = new ListingService(alpha.db);
        for (let i = 0; i < 5; i++) {
          const property = await properties.create(alpha.agencyId, alpha.userId, {
            type: 'apartment',
            rooms: 2,
            settlement_id: sofiaId,
            address: `ул. Съвпадение ${i + 1}`,
          });
          cleanup.track('properties', property.id);
          await listings.create(alpha.agencyId, alpha.userId, { property_id: property.id, offer_type: 'sale', price: PRICE });
          propertyIds.push(property.id);
        }
        const link = await new OpportunityPropertyService(alpha.db).addCandidate(alpha.agencyId, alpha.userId, {
          opportunity_id: dealId,
          property_id: propertyIds[0],
        });
        cleanup.track('opportunity_properties', link.id);
        linkedId = propertyIds[0];
      }, 30_000);

      it('shows linked properties with their status when asked, and counts both views', async () => {
        const fresh = await matching.forOpportunity(dealId, alpha.agencyId, 'en');
        const all = await matching.forOpportunity(dealId, alpha.agencyId, 'en', { includeLinked: true });

        expect(fresh).toMatchObject({ total: 4, unlinked: 4 });
        expect(fresh.rows[0].settlement_name).toBe('Sofia');
        const bg = await matching.forOpportunity(dealId, alpha.agencyId, 'bg');
        expect(bg.rows.map((row) => row.property_id)).toEqual(fresh.rows.map((row) => row.property_id));
        expect(bg.rows[0].settlement_name).toBe('София');
        expect(fresh.rows.map((row) => row.property_id)).not.toContain(linkedId);
        expect(all).toMatchObject({ total: 5, unlinked: 4 });
        expect(all.rows.find((row) => row.property_id === linkedId)?.link_status).toBe('candidate');
      });

      it('pages the result with stable totals', async () => {
        const pages = [];
        for (const page of [1, 2]) {
          pages.push(await matching.forOpportunity(dealId, alpha.agencyId, 'en', { pageSize: 2, page }));
        }

        expect(pages.map((page) => page.rows.length)).toEqual([2, 2]);
        expect(pages.every((page) => page.total === 4 && page.unlinked === 4)).toBe(true);
        const ids = pages.flatMap((page) => page.rows.map((row) => row.property_id));
        expect(new Set(ids).size).toBe(4);
      });

      it('falls back to the first page, with the real counts, for a page past the end', async () => {
        const first = await matching.forOpportunity(dealId, alpha.agencyId, 'en', { pageSize: 2 });
        const beyond = await matching.forOpportunity(dealId, alpha.agencyId, 'en', { pageSize: 2, page: 999 });

        expect(beyond).toMatchObject({ page: 1, total: 4 });
        expect(beyond.rows.map((row) => row.property_id)).toEqual(first.rows.map((row) => row.property_id));
      });
    });

    it('returns an empty page for a deal without a requirement', async () => {
      const opportunity = await createOpportunity();
      const page = await matching.forOpportunity(opportunity.id, alpha.agencyId, 'en');
      expect(page).toMatchObject({ rows: [], total: 0, unlinked: 0 });
    });

    it('returns an empty page for a won deal, and matches again once reopened', async () => {
      const opportunity = await createOpportunity();
      await new RequirementService(alpha.db).save(alpha.agencyId, opportunity.id, anyRequirement());
      const opportunities = new OpportunityService(alpha.db);
      expect((await matching.forOpportunity(opportunity.id, alpha.agencyId, 'en')).total).toBeGreaterThan(0);

      await opportunities.close(opportunity.id, alpha.agencyId, { outcome: 'won' });
      expect((await matching.forOpportunity(opportunity.id, alpha.agencyId, 'en')).rows).toEqual([]);

      await opportunities.reactivate(opportunity.id, alpha.agencyId);
      expect((await matching.forOpportunity(opportunity.id, alpha.agencyId, 'en')).total).toBeGreaterThan(0);
    });

    it('returns an empty page for a seller deal', async () => {
      const opportunity = await createOpportunity('seller');
      expect((await matching.forOpportunity(opportunity.id, alpha.agencyId, 'en')).rows).toEqual([]);
    });
  });

  describe('forProperty', () => {
    it('lists the deals a property fits with the contact and the broker named', async () => {
      const page = await matching.forProperty(EXACT_PROPERTY, alpha.agencyId);

      const row = page.rows.find((match) => match.opportunity_id === ALPHA_OPP_1);
      expect(row).toMatchObject({
        opportunity_type: 'buyer',
        offer_type: 'sale',
        score: 100,
        link_status: null,
        contact_name: 'Ivan Ivanov',
      });
      expect(row!.broker_name).toBeTruthy();
      expect(page.total).toBe(page.unlinked);
      expect(page.rows.every((match) => match.opportunity_type === 'buyer')).toBe(true);
    });

    it('hides linked deals unless asked', async () => {
      const hidden = await matching.forProperty(OFFERED_PROPERTY, alpha.agencyId);
      const shown = await matching.forProperty(OFFERED_PROPERTY, alpha.agencyId, { includeLinked: true });

      expect(hidden.rows.map((row) => row.opportunity_id)).not.toContain(ALPHA_OPP_1);
      expect(shown.rows.find((row) => row.opportunity_id === ALPHA_OPP_1)?.link_status).toBe('offered');
    });

    it('never returns the deals of another agency', async () => {
      const beta = await signInAs('broker@beta.bg');
      const page = await new MatchingService(beta.db).forProperty(EXACT_PROPERTY, beta.agencyId);
      expect(page.rows).toEqual([]);
    });
  });
});
