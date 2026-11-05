import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { OpportunityService } from '@/domain/opportunities/service';
import { SettlementService } from '@/domain/settlements/service';
import { RequirementRepository } from './repository';
import type { Requirement, RequirementLocation } from './types';
import { requirementEditable, requirementInputSchema, toRpcArgs, type RequirementInput } from './validation';

/**
 * The database owns the rules (AD-059): the RPCs check the agency, the deal type and status,
 * the `CHECK`s rules 2–4. This service resolves names for the page and passes refusals on as
 * i18n keys.
 */
export class RequirementService {
  private readonly repo: RequirementRepository;

  constructor(private readonly db: SupabaseClient) {
    this.repo = new RequirementRepository(db);
  }

  /**
   * The opportunity's requirement with location names in `locale`, settlements by name with
   * the whole settlement first and areas in the agency's order; null when it has none.
   */
  async getForOpportunity(opportunityId: string, agencyId: string, locale: Locale): Promise<Requirement | null> {
    const row = await this.repo.findByOpportunity(opportunityId, agencyId);
    if (!row) return null;

    const areaIds = row.locations.flatMap((location) => (location.area_id ? [location.area_id] : []));
    const [settlements, areas] = await Promise.all([
      new SettlementService(this.db).getByIds(row.locations.map((location) => location.settlement_id), locale),
      areaIds.length > 0 ? new AreaService(this.db).getByIds(areaIds, agencyId) : Promise.resolve([]),
    ]);
    const settlementName = new Map(settlements.map((settlement) => [settlement.id, settlement.name]));
    const areaById = new Map(areas.map((area) => [area.id, area]));

    // A whole settlement (no area) sorts before its areas.
    const order = (location: RequirementLocation) => (location.area_id ? (areaById.get(location.area_id)?.sort_order ?? 0) : -1);
    const locations = row.locations
      .map((location): RequirementLocation => {
        const area = location.area_id ? areaById.get(location.area_id) : undefined;
        return {
          settlement_id: location.settlement_id,
          settlement_name: settlementName.get(location.settlement_id) ?? '',
          area_id: location.area_id,
          area_name: area?.name ?? null,
          area_active: location.area_id ? (area?.is_active ?? false) : null,
        };
      })
      .sort((a, b) => a.settlement_name.localeCompare(b.settlement_name, locale) || order(a) - order(b));

    return { ...row, locations };
  }

  /**
   * Creates or replaces the deal's requirement (rules 1–4, 7). A seller or landlord deal and a
   * closed one get their message before the RPC, which checks the same again under a lock.
   * Returns the requirement id.
   */
  async save(agencyId: string, opportunityId: string, input: RequirementInput): Promise<string> {
    const values = requirementInputSchema.parse(input);
    await this.assertWritable(agencyId, opportunityId);
    const { fields, locations } = toRpcArgs(values);
    return this.repo.save(opportunityId, fields, locations);
  }

  /** Deletes the requirement and its locations; the timeline keeps its entries (rule 8). */
  async remove(agencyId: string, opportunityId: string): Promise<void> {
    await this.assertWritable(agencyId, opportunityId);
    await this.repo.remove(opportunityId);
  }

  /** The friendly side of the RPC's checks: `notFound`, `wrongOpportunityType`, `readOnly`. */
  private async assertWritable(agencyId: string, opportunityId: string): Promise<void> {
    const opportunity = await new OpportunityService(this.db).getById(opportunityId, agencyId);
    if (!opportunity) throw new DomainError('requirements.errors.notFound');
    if (opportunity.type !== 'buyer' && opportunity.type !== 'tenant') {
      throw new DomainError('requirements.errors.wrongOpportunityType');
    }
    if (!requirementEditable(opportunity.status)) throw new DomainError('requirements.errors.readOnly');
  }
}
