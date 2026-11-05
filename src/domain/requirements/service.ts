import type { SupabaseClient } from '@supabase/supabase-js';
import { createFormatter, createTranslator, type AbstractIntlMessages } from 'next-intl';
import bg from '../../../messages/bg.json';
import en from '../../../messages/en.json';
import type { Locale } from '@/i18n/config';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { OpportunityService } from '@/domain/opportunities/service';
import { SettlementService } from '@/domain/settlements/service';
import { RequirementRepository, type RequirementWithLocationRows } from './repository';
import type { Opportunity } from '@/domain/opportunities/types';
import { summarizeRequirement, summaryText, type SummaryTools } from './summary';
import type { Requirement, RequirementLocation } from './types';
import { requirementEditable, requirementInputSchema, toRpcArgs, type RequirementInput } from './validation';

/** Untyped, so the translators take any key like the app's do (as in `summary.test.ts`). */
const MESSAGES: Record<Locale, AbstractIntlMessages> = { bg, en };

const translator = (locale: Locale, namespace: 'requirements' | 'Enums') =>
  createTranslator({ locale, messages: MESSAGES[locale], namespace }) as unknown as SummaryTools['t'];

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
    const [requirement] = await this.withNames([row], agencyId, locale);
    return requirement;
  }

  /**
   * The requirements of a page of deals (the opportunities list, the contact page), named as
   * on the opportunity page, by opportunity id; deals without one are absent.
   */
  async getForOpportunities(opportunityIds: string[], agencyId: string, locale: Locale): Promise<Map<string, Requirement>> {
    const rows = await this.repo.findByOpportunities(opportunityIds, agencyId);
    const requirements = await this.withNames(rows, agencyId, locale);
    return new Map(requirements.map((requirement) => [requirement.opportunity_id, requirement]));
  }

  /**
   * The summary line of each buyer and tenant deal that has a requirement, by opportunity id,
   * in `locale`. Built here rather than in the browser, so a list page sends one string per row
   * instead of the whole requirement.
   */
  async getSummaries(
    deals: Pick<Opportunity, 'id' | 'type'>[],
    agencyId: string,
    locale: Locale,
  ): Promise<Record<string, string>> {
    const types = new Map(deals.filter((deal) => deal.type === 'buyer' || deal.type === 'tenant').map((deal) => [deal.id, deal.type]));
    const requirements = await this.getForOpportunities([...types.keys()], agencyId, locale);
    const tools: SummaryTools = {
      t: translator(locale, 'requirements'),
      enums: translator(locale, 'Enums'),
      format: createFormatter({ locale }),
    };
    return Object.fromEntries(
      [...requirements].map(([id, requirement]) => [id, summaryText(summarizeRequirement(requirement, types.get(id)!, tools))]),
    );
  }

  /** Location names in `locale` for all the rows at once: one settlement and one area query. */
  private async withNames(rows: RequirementWithLocationRows[], agencyId: string, locale: Locale): Promise<Requirement[]> {
    if (rows.length === 0) return [];
    const all = rows.flatMap((row) => row.locations);
    const settlementIds = [...new Set(all.map((location) => location.settlement_id))];
    const areaIds = [...new Set(all.flatMap((location) => (location.area_id ? [location.area_id] : [])))];
    const [settlements, areas] = await Promise.all([
      settlementIds.length > 0 ? new SettlementService(this.db).getByIds(settlementIds, locale) : Promise.resolve([]),
      areaIds.length > 0 ? new AreaService(this.db).getByIds(areaIds, agencyId) : Promise.resolve([]),
    ]);
    const settlementName = new Map(settlements.map((settlement) => [settlement.id, settlement.name]));
    const areaById = new Map(areas.map((area) => [area.id, area]));

    // A whole settlement (no area) sorts before its areas.
    const order = (location: RequirementLocation) => (location.area_id ? (areaById.get(location.area_id)?.sort_order ?? 0) : -1);
    return rows.map((row) => {
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
    });
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
