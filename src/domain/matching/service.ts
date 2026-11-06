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
  return { page, pageSize, includeLinked: options.includeLinked ?? false };
}

type Counted = { total_count: number; unlinked_count: number };

/** Moves the page counts off the rows: they belong to the page, not to any one match. */
function splitCounts<T extends Counted>(rows: T[]) {
  const split = rows.map(({ total_count, unlinked_count, ...row }) => ({ row, total: Number(total_count), unlinked: Number(unlinked_count) }));
  return { rows: split.map((entry) => entry.row), total: split[0]?.total ?? 0, unlinked: split[0]?.unlinked ?? 0 };
}

/**
 * One page of a list function. A page past the end has no rows and so no counts: the first page
 * is returned instead, so a stale `?matchesPage=` or a deleted last row never shows a false "no matches".
 */
async function fetchPage<T extends Counted>(
  fetch: (offset: number) => Promise<T[]>,
  page: number,
  pageSize: number,
): Promise<{ page: number } & ReturnType<typeof splitCounts<T>>> {
  const rows = await fetch((page - 1) * pageSize);
  if (rows.length === 0 && page > 1) return { page: 1, ...splitCounts(await fetch(0)) };
  return { page, ...splitCounts(rows) };
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
    const { page: requested, pageSize, includeLinked } = paging(options);
    const { rows, total, unlinked, page } = await fetchPage(
      (offset) => this.repo.propertiesForOpportunity(opportunityId, { includeLinked, limit: pageSize, offset }),
      requested,
      pageSize,
    );

    const [settlements, areas] = await Promise.all([
      new SettlementService(this.db).getByIds(rows.map((row) => row.settlement_id), locale),
      new AreaService(this.db).getByIds(rows.flatMap((row) => (row.area_id ? [row.area_id] : [])), agencyId),
    ]);
    const settlementName = new Map(settlements.map((settlement) => [settlement.id, settlement.name]));
    const areaName = new Map(areas.map((area) => [area.id, area.name]));

    return {
      rows: rows.map(({ settlement_id, area_id, ...row }) => ({
        ...row,
        settlement_name: settlementName.get(settlement_id) ?? '',
        area_name: area_id ? (areaName.get(area_id) ?? null) : null,
      })),
      total,
      unlinked,
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
    const { page: requested, pageSize, includeLinked } = paging(options);
    const { rows, total, unlinked, page } = await fetchPage(
      (offset) => this.repo.opportunitiesForProperty(propertyId, { includeLinked, limit: pageSize, offset }),
      requested,
      pageSize,
    );

    const [contacts, profiles] = await Promise.all([
      new ContactService(this.db).getByIds(rows.flatMap((row) => (row.primary_contact_id ? [row.primary_contact_id] : [])), agencyId),
      new ProfileRepository(this.db).getProfilesByIds(rows.flatMap((row) => (row.assigned_to ? [row.assigned_to] : []))),
    ]);
    const contactName = new Map(contacts.map((contact) => [contact.id, contact.display_name]));

    return {
      rows: rows.map((row) => ({
        ...row,
        contact_name: row.primary_contact_id ? (contactName.get(row.primary_contact_id) ?? null) : null,
        broker_name: row.assigned_to ? (profiles.get(row.assigned_to)?.display_name ?? null) : null,
      })),
      total,
      unlinked,
      page,
      pageSize,
    };
  }
}
