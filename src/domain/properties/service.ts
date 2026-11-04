import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { MemberRepository } from '@/domain/members/repository';
import { UNKNOWN_MEMBER_NAME } from '@/domain/members/types';
import { ProfileRepository } from '@/domain/profiles/repository';
import { SettlementService } from '@/domain/settlements/service';
import { PropertyRepository } from './repository';
import type { PagedRows } from '@/lib/pagination';
import type { PropertyListFilters } from './list-filters';
import type { Property, PropertyDetail, PropertyListItem, PropertyListRow, PropertyOption } from './types';
import { propertyFormSchema, type PropertyFormInput } from './validation';

export class PropertyService {
  private readonly repo: PropertyRepository;

  constructor(private readonly db: SupabaseClient) {
    this.repo = new PropertyRepository(db);
  }

  async getById(id: string, agencyId: string): Promise<Property | null> {
    return this.repo.findById(id, agencyId);
  }

  /** The property with its settlement and area names and its responsible broker, or null (404). */
  async getDetail(id: string, agencyId: string, locale: Locale): Promise<PropertyDetail | null> {
    const property = await this.repo.findById(id, agencyId);
    if (!property) return null;

    const [settlement, areas, profiles] = await Promise.all([
      new SettlementService(this.db).getById(property.settlement_id, locale),
      property.area_id ? new AreaService(this.db).getByIds([property.area_id], agencyId) : Promise.resolve([]),
      property.assigned_to
        ? new ProfileRepository(this.db).getProfilesByIds([property.assigned_to])
        : Promise.resolve(new Map()),
    ]);
    if (!settlement) throw new DomainError('errors.loadFailed', `Settlement ${property.settlement_id} is missing`);

    const area = areas[0];
    return {
      ...property,
      settlement,
      area: area ? { id: area.id, name: area.name } : null,
      assignee: property.assigned_to
        ? { id: property.assigned_to, display_name: profiles.get(property.assigned_to)?.display_name || UNKNOWN_MEMBER_NAME }
        : null,
    };
  }

  /** One page of `/properties` with location names in `locale`. */
  async listPage(
    agencyId: string,
    filters: PropertyListFilters,
    locale: Locale,
    page: { limit: number; offset: number },
  ): Promise<PagedRows<PropertyListRow>> {
    const { rows, total } = await this.repo.findPage(agencyId, filters, page);
    return { rows: await this.withLocations(rows, agencyId, locale), total };
  }

  /** At most 20 active properties matching a code or an address, for the pickers. */
  async searchForPicker(agencyId: string, query: string, locale: Locale): Promise<PropertyOption[]> {
    const rows = await this.repo.searchActive(agencyId, query.trim(), 20);
    return (await this.withLocations(rows, agencyId, locale)).map(
      ({ id, code, type, rooms, area_m2, address, status, settlement_name, area_name }) => ({
        id, code, type, rooms, area_m2, address, status, settlement_name, area_name,
      }),
    );
  }

  private async withLocations<T extends Property>(
    rows: T[],
    agencyId: string,
    locale: Locale,
  ): Promise<(T & PropertyListItem)[]> {
    const [settlements, areas] = await Promise.all([
      new SettlementService(this.db).getByIds(rows.map((row) => row.settlement_id), locale),
      new AreaService(this.db).getByIds(rows.flatMap((row) => (row.area_id ? [row.area_id] : [])), agencyId),
    ]);
    const settlementById = new Map(settlements.map((settlement) => [settlement.id, settlement.name]));
    const areaById = new Map(areas.map((area) => [area.id, area.name]));
    return rows.map((row) => ({
      ...row,
      settlement_name: settlementById.get(row.settlement_id) ?? '',
      area_name: row.area_id ? (areaById.get(row.area_id) ?? null) : null,
    }));
  }

  /** Rule 2: the responsible broker is an active member; the creator when none is chosen. */
  async create(agencyId: string, userId: string, input: PropertyFormInput): Promise<Property> {
    const parsed = propertyFormSchema.parse(input);
    const assignedTo = parsed.assigned_to ?? userId;
    await this.assertAssignable(agencyId, assignedTo);
    return this.repo.create(agencyId, userId, { ...parsed, assigned_to: assignedTo });
  }

  /** Edits the attributes and the responsible broker; leaving the broker out keeps the current one. */
  async update(id: string, agencyId: string, input: PropertyFormInput): Promise<Property> {
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');
    const parsed = propertyFormSchema.parse(input);
    const assignedTo = parsed.assigned_to ?? current.assigned_to;
    if (assignedTo) await this.assertAssignable(agencyId, assignedTo, current.assigned_to);
    return this.repo.update(id, agencyId, { ...parsed, assigned_to: assignedTo });
  }

  /** Any member archives or unarchives; archiving withdraws open listings (L12). */
  async setArchived(id: string, agencyId: string, archived: boolean): Promise<Property> {
    return this.repo.update(id, agencyId, { status: archived ? 'archived' : 'active' });
  }

  /**
   * Owner/manager only (T2, RLS). A property with links, open listings or tasks is archived
   * instead (rule 1); tasks only SET NULL in the database, so that part is checked here.
   */
  async delete(id: string, agencyId: string): Promise<void> {
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');
    if ((await this.repo.countUsage(id, agencyId)) > 0) throw new DomainError('properties.errors.inUse');
    if (!(await this.repo.delete(id, agencyId))) throw new DomainError('errors.forbidden');
  }

  /** Same check as I4. Keeping the current assignee is always allowed. */
  private async assertAssignable(agencyId: string, assignedTo: string, currentAssignee: string | null = null) {
    if (assignedTo === currentAssignee) return;
    if (!(await new MemberRepository(this.db).isActiveMember(agencyId, assignedTo))) {
      throw new DomainError('properties.errors.assigneeNotMember');
    }
  }
}
