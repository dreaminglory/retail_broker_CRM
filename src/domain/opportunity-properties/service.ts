import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { SettlementService } from '@/domain/settlements/service';
import { OpportunityService } from '@/domain/opportunities/service';
import { PropertyPartyService } from '@/domain/property-parties/service';
import { PropertyService } from '@/domain/properties/service';
import type { Property } from '@/domain/properties/types';
import type { PropertyFormInput } from '@/domain/properties/validation';
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

  /** The one subject property of a seller or landlord deal (rule 5, L7, L10). */
  async setSubject(agencyId: string, userId: string, input: AddCandidateInput): Promise<OpportunityProperty> {
    const parsed = addCandidateSchema.parse(input);
    return this.repo.create(agencyId, userId, { ...parsed, relation: 'subject', status: null });
  }

  /**
   * "Create property" from a seller or landlord deal: the property, the deal's primary contact
   * as its owner, and the subject link. Three writes, not one transaction, so the deal is checked
   * first; a later failure leaves the property without its link (domain model, known gap 6).
   */
  async createSubjectProperty(
    agencyId: string,
    userId: string,
    opportunityId: string,
    input: PropertyFormInput,
  ): Promise<Property> {
    const opportunity = await new OpportunityService(this.db).getById(opportunityId, agencyId);
    if (!opportunity) throw new DomainError('errors.not_found');
    if (opportunity.type !== 'seller' && opportunity.type !== 'landlord') {
      throw new DomainError('properties.errors.relationNotAllowed');
    }
    const links = await this.repo.findByOpportunity(opportunityId, agencyId);
    if (links.some((link) => link.relation === 'subject')) {
      throw new DomainError('opportunityProperties.errors.subjectExists');
    }

    const property = await new PropertyService(this.db).create(agencyId, userId, input);
    if (opportunity.primary_contact_id) {
      await new PropertyPartyService(this.db).add(agencyId, userId, {
        property_id: property.id,
        contact_id: opportunity.primary_contact_id,
        role: 'owner',
      });
    }
    await this.setSubject(agencyId, userId, { opportunity_id: opportunityId, property_id: property.id });
    return property;
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
