import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { OpportunityService } from '@/domain/opportunities/service';
import type { OpportunityType } from '@/domain/opportunities/types';
import { RequirementService } from '@/domain/requirements/service';
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
    it('lists the new matches best first, reserved last, with names in the locale', async () => {
      const bg = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'bg');

      expect(bg.rows[0]).toMatchObject({ score: 100, listing_status: 'active', link_status: null, settlement_name: 'София' });
      expect(bg.rows[0].area_name).toBeTruthy();
      expect(bg.rows.map((row) => row.property_id)).not.toContain(OFFERED_PROPERTY);
      expect(bg.rows.find((row) => row.property_id === RESERVED_PROPERTY)).toBeDefined();
      const statuses = bg.rows.map((row) => row.listing_status);
      expect(statuses.lastIndexOf('active')).toBeLessThan(statuses.indexOf('reserved'));
      expect(bg.unlinked).toBe(bg.total);

      const en = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'en');
      expect(en.rows[0].settlement_name).toBe('Sofia');
      expect(en.rows.map((row) => row.property_id)).toEqual(bg.rows.map((row) => row.property_id));
    });

    it('shows linked properties with their status when asked, and counts both views', async () => {
      const fresh = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'en');
      const all = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'en', { includeLinked: true });

      expect(all.rows.find((row) => row.property_id === OFFERED_PROPERTY)?.link_status).toBe('offered');
      expect(all.total).toBeGreaterThan(fresh.total);
      expect(all.unlinked).toBe(fresh.total);
    });

    it('pages the result with stable totals', async () => {
      const first = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'en', { pageSize: 2 });
      const second = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'en', { pageSize: 2, page: 2 });

      expect(first.rows).toHaveLength(2);
      expect(first).toMatchObject({ page: 1, pageSize: 2 });
      expect(second.page).toBe(2);
      expect(second.total).toBe(first.total);
      expect(first.total).toBeGreaterThan(2);
      const ids = [...first.rows, ...second.rows].map((row) => row.property_id);
      expect(new Set(ids).size).toBe(ids.length);

      // A page past the end falls back to the first page, with the real counts.
      const beyond = await matching.forOpportunity(ALPHA_OPP_1, alpha.agencyId, 'en', { pageSize: 2, page: 999 });
      expect(beyond).toMatchObject({ page: 1, total: first.total });
      expect(beyond.rows.map((row) => row.property_id)).toEqual(first.rows.map((row) => row.property_id));
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
