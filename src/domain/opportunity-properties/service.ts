import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { SettlementService } from '@/domain/settlements/service';
import { OpportunityPropertyRepository } from './repository';
import type { OpportunityProperty, OpportunityPropertyWithProperty, PropertyOpportunityLink } from './types';
import {
  addCandidateSchema,
  setLinkStatusSchema,
  type AddCandidateInput,
  type SetLinkStatusInput,
} from './validation';

/**
 * The database owns the rules (rule 5 relation vs type, rule 8 archived, one `selected`); this
 * service passes their refusals on as i18n keys.
 */
export class OpportunityPropertyService {
  private readonly repo: OpportunityPropertyRepository;

  constructor(private readonly db: SupabaseClient) {
    this.repo = new OpportunityPropertyRepository(db);
  }

  /** The opportunity's properties, oldest link first, with location names in `locale`. */
  async listForOpportunity(opportunityId: string, agencyId: string, locale: Locale): Promise<OpportunityPropertyWithProperty[]> {
    const rows = await this.repo.findByOpportunity(opportunityId, agencyId);
    const [settlements, areas] = await Promise.all([
      new SettlementService(this.db).getByIds(rows.map((row) => row.property.settlement_id), locale),
      new AreaService(this.db).getByIds(rows.flatMap((row) => (row.property.area_id ? [row.property.area_id] : [])), agencyId),
    ]);
    const settlementName = new Map(settlements.map((settlement) => [settlement.id, settlement.name]));
    const areaName = new Map(areas.map((area) => [area.id, area.name]));

    return rows.map(({ property: { settlement_id, area_id, ...property }, ...link }) => ({
      ...link,
      property: {
        ...property,
        settlement_name: settlementName.get(settlement_id) ?? '',
        area_name: area_id ? (areaName.get(area_id) ?? null) : null,
      },
    }));
  }

  /** The opportunities a property is linked to, newest first. */
  async listForProperty(propertyId: string, agencyId: string): Promise<PropertyOpportunityLink[]> {
    return this.repo.findByProperty(propertyId, agencyId);
  }

  async addCandidate(agencyId: string, userId: string, input: AddCandidateInput): Promise<OpportunityProperty> {
    const parsed = addCandidateSchema.parse(input);
    return this.repo.create(agencyId, userId, { ...parsed, relation: 'candidate', status: 'candidate' });
  }

  async setStatus(id: string, agencyId: string, input: SetLinkStatusInput): Promise<OpportunityProperty> {
    const updated = await this.repo.updateStatus(id, agencyId, setLinkStatusSchema.parse(input));
    if (!updated) throw new DomainError('errors.not_found');
    return updated;
  }

  /** Removing a link is audited too (status → NULL). */
  async remove(id: string, agencyId: string): Promise<OpportunityProperty> {
    const removed = await this.repo.delete(id, agencyId);
    if (!removed) throw new DomainError('errors.not_found');
    return removed;
  }
}
