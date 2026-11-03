import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import { SettlementService } from '@/domain/settlements/service';
import { AreaRepository } from './repository';
import type { Area, SettlementAreaCount } from './types';
import {
  createAreaSchema,
  reorderAreasSchema,
  updateAreaSchema,
  type CreateAreaInput,
  type ReorderAreasInput,
  type UpdateAreaInput,
} from './validation';

/**
 * Areas are configured by owners and managers (T6): the actions check the role and RLS
 * refuses the write for anyone else. Areas are deactivated, not deleted, because a used
 * area can't be deleted (fk_properties_area is RESTRICT).
 */
export class AreaService {
  private readonly repo: AreaRepository;
  private readonly settlements: SettlementService;

  constructor(db: SupabaseClient) {
    this.repo = new AreaRepository(db);
    this.settlements = new SettlementService(db);
  }

  async listForSettlement(agencyId: string, settlementId: string): Promise<Area[]> {
    return this.repo.findBySettlement(agencyId, settlementId);
  }

  /** For the property form's area select. */
  async listActiveForSettlement(agencyId: string, settlementId: string): Promise<Area[]> {
    return this.repo.findBySettlement(agencyId, settlementId, true);
  }

  async getByIds(ids: string[], agencyId: string): Promise<Area[]> {
    return this.repo.findByIds([...new Set(ids)], agencyId);
  }

  /** The settlements that have areas, by name, with their counts. */
  async settlementsWithAreas(agencyId: string, locale: Locale): Promise<SettlementAreaCount[]> {
    const counts = new Map<string, number>();
    for (const id of await this.repo.findSettlementIds(agencyId)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const settlements = await this.settlements.getByIds([...counts.keys()], locale);
    return settlements
      .map((settlement) => ({ settlement, count: counts.get(settlement.id) ?? 0 }))
      .sort((a, b) => a.settlement.name.localeCompare(b.settlement.name, locale));
  }

  /** A new area goes to the end of its settlement's list. */
  async create(agencyId: string, input: CreateAreaInput): Promise<Area> {
    const parsed = createAreaSchema.parse(input);
    const existing = await this.repo.findBySettlement(agencyId, parsed.settlement_id);
    const sortOrder = existing.reduce((max, area) => Math.max(max, area.sort_order + 1), 0);
    return this.repo.create(agencyId, parsed, sortOrder);
  }

  async update(id: string, agencyId: string, input: UpdateAreaInput): Promise<Area> {
    return this.repo.update(id, agencyId, updateAreaSchema.parse(input));
  }

  async reorder(agencyId: string, input: ReorderAreasInput): Promise<void> {
    await this.repo.reorder(agencyId, reorderAreasSchema.parse(input));
  }
}
