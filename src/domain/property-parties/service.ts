import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { SettlementService } from '@/domain/settlements/service';
import { PropertyPartyRepository } from './repository';
import type { ContactPropertyParty, PropertyParty, PropertyPartyWithContact } from './types';
import { addPropertyPartySchema, type AddPropertyPartyInput } from './validation';

/**
 * Parties are picked from existing contacts or created with the contact form first, so the
 * duplicate check (C3) has already run; there is no second one here (rule 10).
 */
export class PropertyPartyService {
  private readonly repo: PropertyPartyRepository;

  constructor(private readonly db: SupabaseClient) {
    this.repo = new PropertyPartyRepository(db);
  }

  async listForProperty(
    propertyId: string,
    agencyId: string,
  ): Promise<{ current: PropertyPartyWithContact[]; past: PropertyPartyWithContact[] }> {
    const rows = await this.repo.findByProperty(propertyId, agencyId);
    return {
      current: rows.filter((row) => row.ended_at === null),
      past: rows.filter((row) => row.ended_at !== null).sort((a, b) => b.ended_at!.localeCompare(a.ended_at!)),
    };
  }

  /** The contact's properties with role and location names, current ones first. */
  async listForContact(contactId: string, agencyId: string, locale: Locale): Promise<ContactPropertyParty[]> {
    const rows = await this.repo.findByContact(contactId, agencyId);
    const [settlements, areas] = await Promise.all([
      new SettlementService(this.db).getByIds(rows.map((row) => row.property.settlement_id), locale),
      new AreaService(this.db).getByIds(rows.flatMap((row) => (row.property.area_id ? [row.property.area_id] : [])), agencyId),
    ]);
    const settlementName = new Map(settlements.map((settlement) => [settlement.id, settlement.name]));
    const areaName = new Map(areas.map((area) => [area.id, area.name]));

    return rows
      .map(({ property: { settlement_id, area_id, ...property }, ...party }) => ({
        ...party,
        property: {
          ...property,
          settlement_name: settlementName.get(settlement_id) ?? '',
          area_name: area_id ? (areaName.get(area_id) ?? null) : null,
        },
      }))
      .sort((a, b) => Number(a.ended_at !== null) - Number(b.ended_at !== null));
  }

  async add(agencyId: string, userId: string, input: AddPropertyPartyInput): Promise<PropertyParty> {
    return this.repo.create(agencyId, userId, addPropertyPartySchema.parse(input));
  }

  async end(id: string, agencyId: string): Promise<PropertyParty> {
    const ended = await this.repo.end(id, agencyId);
    if (!ended) throw new DomainError('propertyParties.errors.alreadyEnded');
    return ended;
  }
}
