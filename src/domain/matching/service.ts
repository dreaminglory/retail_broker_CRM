import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { AreaService } from '@/domain/areas/service';
import { ContactService } from '@/domain/contacts/service';
import { ProfileRepository } from '@/domain/profiles/repository';
import { SettlementService } from '@/domain/settlements/service';
import { MatchingRepository } from './repository';
import type { MatchPage, MatchPageOptions, OpportunityMatch, PropertyMatch } from './types';

export const MATCH_PAGE_SIZE = 20;

function paging(options: MatchPageOptions) {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? MATCH_PAGE_SIZE)));
  return { page, pageSize, includeLinked: options.includeLinked ?? false, limit: pageSize, offset: (page - 1) * pageSize };
}

/** A row without the page counts, which move to the page itself. */
function omitCounts<T extends { total_count: number; unlinked_count: number }>(
  row: T,
): Omit<T, 'total_count' | 'unlinked_count'> {
  const rest: Partial<T> = { ...row };
  delete rest.total_count;
  delete rest.unlinked_count;
  return rest as Omit<T, 'total_count' | 'unlinked_count'>;
}

/**
 * Reads the matches (AD-060). The database decides who fits and how well; this service pages
 * the result and adds the names the functions don't carry: settlement and area, and for the
 * property side the contact and the broker.
 */
export class MatchingService {
  private readonly repo: MatchingRepository;

  constructor(private readonly db: SupabaseClient) {
    this.repo = new MatchingRepository(db);
  }

  /** The properties that fit a buyer or tenant deal. Empty for any other deal. */
  async forOpportunity(
    opportunityId: string,
    agencyId: string,
    locale: Locale,
    options: MatchPageOptions = {},
  ): Promise<MatchPage<PropertyMatch>> {
    const { page, pageSize, includeLinked, limit, offset } = paging(options);
    const rows = await this.repo.propertiesForOpportunity(opportunityId, { includeLinked, limit, offset });

    const [settlements, areas] = await Promise.all([
      new SettlementService(this.db).getByIds(rows.map((row) => row.settlement_id), locale),
      new AreaService(this.db).getByIds(rows.flatMap((row) => (row.area_id ? [row.area_id] : [])), agencyId),
    ]);
    const settlementName = new Map(settlements.map((settlement) => [settlement.id, settlement.name]));
    const areaName = new Map(areas.map((area) => [area.id, area.name]));

    return {
      rows: rows.map(({ settlement_id, area_id, ...row }) => ({
        ...omitCounts(row),
        settlement_name: settlementName.get(settlement_id) ?? '',
        area_name: area_id ? (areaName.get(area_id) ?? null) : null,
      })),
      total: Number(rows[0]?.total_count ?? 0),
      unlinked: Number(rows[0]?.unlinked_count ?? 0),
      page,
      pageSize,
    };
  }

  /** The buyer and tenant deals that fit a property's open listings. */
  async forProperty(
    propertyId: string,
    agencyId: string,
    options: MatchPageOptions = {},
  ): Promise<MatchPage<OpportunityMatch>> {
    const { page, pageSize, includeLinked, limit, offset } = paging(options);
    const rows = await this.repo.opportunitiesForProperty(propertyId, { includeLinked, limit, offset });

    const [contacts, profiles] = await Promise.all([
      new ContactService(this.db).getByIds(rows.flatMap((row) => (row.primary_contact_id ? [row.primary_contact_id] : [])), agencyId),
      new ProfileRepository(this.db).getProfilesByIds(rows.flatMap((row) => (row.assigned_to ? [row.assigned_to] : []))),
    ]);
    const contactName = new Map(contacts.map((contact) => [contact.id, contact.display_name]));

    return {
      rows: rows.map((row) => ({
        ...omitCounts(row),
        contact_name: row.primary_contact_id ? (contactName.get(row.primary_contact_id) ?? null) : null,
        broker_name: row.assigned_to ? (profiles.get(row.assigned_to)?.display_name ?? null) : null,
      })),
      total: Number(rows[0]?.total_count ?? 0),
      unlinked: Number(rows[0]?.unlinked_count ?? 0),
      page,
      pageSize,
    };
  }
}
