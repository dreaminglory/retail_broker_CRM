import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { MemberRepository } from '@/domain/members/repository';
import { UNKNOWN_MEMBER_NAME } from '@/domain/members/types';
import { ProfileRepository } from '@/domain/profiles/repository';
import { SettlementService } from '@/domain/settlements/service';
import { PropertyRepository } from './repository';
import type { Property, PropertyDetail, PropertyListItem } from './types';
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

  /** The newest active properties with their location names, for the list. */
  async listRecent(agencyId: string, locale: Locale, limit = 50): Promise<PropertyListItem[]> {
    const rows = await this.repo.findRecent(agencyId, limit);
    return this.withLocations(rows, agencyId, locale);
  }

  private async withLocations(rows: Property[], agencyId: string, locale: Locale): Promise<PropertyListItem[]> {
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

  /** Same check as I4. Keeping the current assignee is always allowed. */
  private async assertAssignable(agencyId: string, assignedTo: string, currentAssignee: string | null = null) {
    if (assignedTo === currentAssignee) return;
    if (!(await new MemberRepository(this.db).isActiveMember(agencyId, assignedTo))) {
      throw new DomainError('properties.errors.assigneeNotMember');
    }
  }
}
