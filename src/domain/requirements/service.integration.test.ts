import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { OpportunityService } from '@/domain/opportunities/service';
import type { OpportunityType } from '@/domain/opportunities/types';
import { SettlementService } from '@/domain/settlements/service';
import { RequirementRepository } from './repository';
import { RequirementService } from './service';
import type { RequirementInput } from './validation';

/** Seeded deals (supabase/seed.sql, requirements block). */
const ALPHA_OPP_1 = '11111111-6666-6666-6666-666666666661';
const ALPHA_OPP_2 = '11111111-6666-6666-6666-666666666662';
const ALPHA_OPP_3 = '11111111-6666-6666-6666-666666666663';
/** Alpha's seeded areas: Лозенец, Младост 1, Център in Sofia; Тракия in Plovdiv. */
const ALPHA_LOZENETS = '11111111-8888-0000-0000-000000000001';
const ALPHA_MLADOST = '11111111-8888-0000-0000-000000000002';
const ALPHA_CENTER = '11111111-8888-0000-0000-000000000003';
const ALPHA_TRAKIA = '11111111-8888-0000-0000-000000000005';

describeServices('RequirementService against the local stack', () => {
  const cleanup = createRowCleanup();
  let alpha: TestSession;
  let beta: TestSession;
  let stageId: string;
  let sofiaId: string;

  beforeAll(async () => {
    [alpha, beta] = await Promise.all([signInAs('broker@alpha.bg'), signInAs('broker@beta.bg')]);
    const { data: stage } = await alpha.db.from('stages').select('id').eq('agency_id', alpha.agencyId).eq('name', 'New').single();
    stageId = stage!.id;
    [{ id: sofiaId }] = await new SettlementService(alpha.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  /** Deleting the deal deletes its requirement (rule 9), so the cleanup tracks deals only. */
  async function createOpportunity(type: OpportunityType = 'buyer') {
    const opportunity = await new OpportunityService(alpha.db).create(alpha.agencyId, alpha.userId, {
      title: `Requirement ${type}`,
      type,
      stage_id: stageId,
      assigned_to: alpha.userId,
    });
    cleanup.track('opportunities', opportunity.id);
    return opportunity;
  }

  const ac1 = (): RequirementInput => ({
    budget_min: 150_000,
    budget_max: 200_000,
    property_types: ['apartment', 'maisonette'],
    rooms_min: 2,
    rooms_max: 3,
    not_top_floor: true,
    construction: ['brick'],
    financing: 'mortgage',
    wishes: 'needs parking',
    budget_must: true,
    location_must: true,
    type_must: true,
    locations: [
      { settlement_id: sofiaId, area_id: ALPHA_LOZENETS },
      { settlement_id: sofiaId, area_id: ALPHA_CENTER },
    ],
  });

  /** The DomainError key a call is refused with. */
  async function refusal(promise: Promise<unknown>) {
    const error = await promise.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }

  describe('getForOpportunity', () => {
    it('reads the seeded buyer requirement with its areas named, in the agency order', async () => {
      const requirement = await new RequirementService(alpha.db).getForOpportunity(ALPHA_OPP_1, alpha.agencyId, 'en');

      expect(requirement).toMatchObject({
        opportunity_id: ALPHA_OPP_1,
        budget_min: 150_000,
        budget_max: 200_000,
        property_types: ['apartment', 'maisonette'],
        rooms_min: 2,
        rooms_max: 3,
        financing: 'mortgage',
        budget_must: true,
        location_must: true,
        type_must: true,
      });
      expect(requirement!.locations).toEqual([
        expect.objectContaining({ settlement_name: 'Sofia', area_name: 'Лозенец', area_active: true }),
        expect.objectContaining({ settlement_name: 'Sofia', area_name: 'Център', area_active: true }),
      ]);
    });

    it('names the settlement in the locale', async () => {
      const requirement = await new RequirementService(alpha.db).getForOpportunity(ALPHA_OPP_1, alpha.agencyId, 'bg');

      expect(requirement!.locations.map((location) => location.settlement_name)).toEqual(['София', 'София']);
    });

    it('reads a budget-only requirement with no locations', async () => {
      const requirement = await new RequirementService(alpha.db).getForOpportunity(ALPHA_OPP_2, alpha.agencyId, 'bg');

      expect(requirement).toMatchObject({ budget_min: null, budget_max: 800, locations: [] });
    });

    it('is null for a deal without one', async () => {
      expect(await new RequirementService(alpha.db).getForOpportunity(ALPHA_OPP_3, alpha.agencyId, 'bg')).toBeNull();
    });

    it("is null for another agency's deal (AC-7)", async () => {
      const service = new RequirementService(beta.db);

      expect(await service.getForOpportunity(ALPHA_OPP_1, beta.agencyId, 'bg')).toBeNull();
      expect(await service.getForOpportunity(ALPHA_OPP_1, alpha.agencyId, 'bg')).toBeNull();
    });
  });

  describe('save', () => {
    it('records AC-1 on a buyer deal and reads it back', async () => {
      const opportunity = await createOpportunity();
      const service = new RequirementService(alpha.db);

      await service.save(alpha.agencyId, opportunity.id, ac1());
      const saved = await service.getForOpportunity(opportunity.id, alpha.agencyId, 'en');

      expect(saved).toMatchObject({
        budget_min: 150_000,
        budget_max: 200_000,
        property_types: ['apartment', 'maisonette'],
        not_top_floor: true,
        construction: ['brick'],
        financing: 'mortgage',
        wishes: 'needs parking',
        budget_must: true,
        location_must: true,
        type_must: true,
        rooms_must: false,
      });
      expect(saved!.locations.map((location) => location.area_name)).toEqual(['Лозенец', 'Център']);
    });

    it('edits the budget and adds a location, keeping the rest (AC-2)', async () => {
      const opportunity = await createOpportunity();
      const service = new RequirementService(alpha.db);
      await service.save(alpha.agencyId, opportunity.id, ac1());

      const edited = ac1();
      await service.save(alpha.agencyId, opportunity.id, {
        ...edited,
        budget_max: 220_000,
        locations: [...edited.locations!, { settlement_id: sofiaId, area_id: ALPHA_MLADOST }],
      });
      const saved = await service.getForOpportunity(opportunity.id, alpha.agencyId, 'bg');

      expect(saved).toMatchObject({ budget_min: 150_000, budget_max: 220_000, rooms_min: 2, wishes: 'needs parking' });
      expect(saved!.locations.map((location) => location.area_name)).toEqual(['Лозенец', 'Младост 1', 'Център']);
    });

    it('saves a whole settlement', async () => {
      const opportunity = await createOpportunity('tenant');
      const service = new RequirementService(alpha.db);

      await service.save(alpha.agencyId, opportunity.id, { budget_max: 800, locations: [{ settlement_id: sofiaId }] });

      expect((await service.getForOpportunity(opportunity.id, alpha.agencyId, 'en'))!.locations).toEqual([
        { settlement_id: sofiaId, settlement_name: 'Sofia', area_id: null, area_name: null, area_active: null },
      ]);
    });

    it('refuses a seller deal before the database does (AC-3)', async () => {
      const opportunity = await createOpportunity('seller');

      expect(await refusal(new RequirementService(alpha.db).save(alpha.agencyId, opportunity.id, ac1()))).toBe(
        'requirements.errors.wrongOpportunityType',
      );
    });

    it('refuses a won deal, and saves again once reopened (AC-6)', async () => {
      const opportunity = await createOpportunity();
      const opportunities = new OpportunityService(alpha.db);
      const service = new RequirementService(alpha.db);
      await opportunities.close(opportunity.id, alpha.agencyId, { outcome: 'won' });

      expect(await refusal(service.save(alpha.agencyId, opportunity.id, ac1()))).toBe('requirements.errors.readOnly');

      await opportunities.reactivate(opportunity.id, alpha.agencyId);
      await service.save(alpha.agencyId, opportunity.id, ac1());
      expect(await service.getForOpportunity(opportunity.id, alpha.agencyId, 'bg')).not.toBeNull();
    });

    it('refuses an area of Plovdiv under Sofia with the database key (AC-4)', async () => {
      const opportunity = await createOpportunity();
      const input = { ...ac1(), locations: [{ settlement_id: sofiaId, area_id: ALPHA_TRAKIA }] };

      expect(await refusal(new RequirementService(alpha.db).save(alpha.agencyId, opportunity.id, input))).toBe(
        'requirements.errors.invalidLocation',
      );
    });

    it("refuses another agency's deal as not found (AC-7)", async () => {
      expect(await refusal(new RequirementService(beta.db).save(beta.agencyId, ALPHA_OPP_3, ac1()))).toBe(
        'requirements.errors.notFound',
      );
    });

    it('refuses what Zod refuses before calling the database', async () => {
      const opportunity = await createOpportunity();

      await expect(new RequirementService(alpha.db).save(alpha.agencyId, opportunity.id, { wishes: 'only wishes' })).rejects.toThrow(
        'validation.requirement_criterion_required',
      );
    });

    // The cases Zod refuses, sent past it: the database refuses them too (AC-4, AC-5).
    it.each([
      ['no criterion', { financing: 'cash', wishes: 'only wishes' }],
      ['rooms_min above rooms_max', { rooms_min: 4, rooms_max: 2 }],
      ['a must-have on an empty criterion', { budget_max: 800, rooms_must: true }],
    ])('the database refuses %s with requirements.errors.invalid', async (_case, fields) => {
      const opportunity = await createOpportunity();

      expect(await refusal(new RequirementRepository(alpha.db).save(opportunity.id, fields, []))).toBe('requirements.errors.invalid');
      expect(await new RequirementService(alpha.db).getForOpportunity(opportunity.id, alpha.agencyId, 'bg')).toBeNull();
    });
  });

  describe('remove', () => {
    it('removes the requirement and its locations (rule 8, AC-6)', async () => {
      const opportunity = await createOpportunity();
      const service = new RequirementService(alpha.db);
      await service.save(alpha.agencyId, opportunity.id, ac1());

      await service.remove(alpha.agencyId, opportunity.id);

      expect(await service.getForOpportunity(opportunity.id, alpha.agencyId, 'bg')).toBeNull();
      const { data: locations } = await alpha.db.from('requirement_locations').select('id').eq('agency_id', alpha.agencyId);
      const { data: kept } = await alpha.db.from('requirements').select('id').eq('opportunity_id', opportunity.id);
      expect(kept).toEqual([]);
      expect(locations!.length).toBeGreaterThan(0); // the seeded ones stay
    });

    it('refuses a deal without one as not found', async () => {
      const opportunity = await createOpportunity();

      expect(await refusal(new RequirementService(alpha.db).remove(alpha.agencyId, opportunity.id))).toBe('requirements.errors.notFound');
    });

    it('refuses a lost deal and keeps the requirement (rule 7)', async () => {
      const opportunity = await createOpportunity();
      const service = new RequirementService(alpha.db);
      await service.save(alpha.agencyId, opportunity.id, ac1());
      await new OpportunityService(alpha.db).close(opportunity.id, alpha.agencyId, { outcome: 'lost', lost_reason: 'Bought elsewhere' });

      expect(await refusal(service.remove(alpha.agencyId, opportunity.id))).toBe('requirements.errors.readOnly');
      expect(await service.getForOpportunity(opportunity.id, alpha.agencyId, 'bg')).not.toBeNull();
    });

    it('lets a nurture deal be edited and cleared', async () => {
      const opportunity = await createOpportunity();
      const service = new RequirementService(alpha.db);
      await new OpportunityService(alpha.db).close(opportunity.id, alpha.agencyId, { outcome: 'nurture' });

      await service.save(alpha.agencyId, opportunity.id, ac1());
      await service.remove(alpha.agencyId, opportunity.id);

      expect(await service.getForOpportunity(opportunity.id, alpha.agencyId, 'bg')).toBeNull();
    });

    it("refuses another agency's deal as not found (AC-7)", async () => {
      expect(await refusal(new RequirementService(beta.db).remove(beta.agencyId, ALPHA_OPP_1))).toBe('requirements.errors.notFound');
      expect(await new RequirementService(alpha.db).getForOpportunity(ALPHA_OPP_1, alpha.agencyId, 'bg')).not.toBeNull();
    });
  });

  describe('type change with a requirement (AC-3)', () => {
    it('refuses buyer → seller with the translated key', async () => {
      const opportunity = await createOpportunity();
      await new RequirementService(alpha.db).save(alpha.agencyId, opportunity.id, ac1());

      expect(await refusal(new OpportunityService(alpha.db).update(opportunity.id, alpha.agencyId, { type: 'seller' }))).toBe(
        'opportunities.errors.typeHasRequirement',
      );
    });

    it('keeps the requirement on buyer → tenant', async () => {
      const opportunity = await createOpportunity();
      const service = new RequirementService(alpha.db);
      await service.save(alpha.agencyId, opportunity.id, ac1());

      await new OpportunityService(alpha.db).update(opportunity.id, alpha.agencyId, { type: 'tenant' });

      expect(await service.getForOpportunity(opportunity.id, alpha.agencyId, 'bg')).toMatchObject({ budget_max: 200_000 });
    });
  });
});
