import { beforeAll, describe, expect, it } from 'vitest';
import { describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { RequirementService } from './service';

/** Seeded deals (supabase/seed.sql, requirements block). */
const ALPHA_OPP_1 = '11111111-6666-6666-6666-666666666661';
const ALPHA_OPP_2 = '11111111-6666-6666-6666-666666666662';
const ALPHA_OPP_3 = '11111111-6666-6666-6666-666666666663';

describeServices('RequirementService against the local stack', () => {
  let alpha: TestSession;
  let beta: TestSession;

  beforeAll(async () => {
    [alpha, beta] = await Promise.all([signInAs('broker@alpha.bg'), signInAs('broker@beta.bg')]);
  });

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
});
