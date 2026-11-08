import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { OpportunityService } from './service';

/** A client whose rpc returns these rows, as smart_list_opportunities would. */
function rpcReturning(rows: Record<string, unknown>[]) {
  return { rpc: async () => ({ data: rows, error: null }) } as unknown as SupabaseClient;
}

describe('OpportunityService.listPage: the agency check in code (AGENTS.md)', () => {
  it('returns the rows of the agency it was asked for', async () => {
    const service = new OpportunityService(rpcReturning([{ id: 'd1', agency_id: 'alpha', total_count: 1 }]));

    const page = await service.listPage('alpha', { limit: 50 });

    expect(page.rows.map((r) => r.id)).toEqual(['d1']);
    expect(page.total).toBe(1);
  });

  it('refuses rows of another agency rather than showing them', async () => {
    const service = new OpportunityService(
      rpcReturning([
        { id: 'd1', agency_id: 'alpha', total_count: 2 },
        { id: 'd2', agency_id: 'beta', total_count: 2 },
      ])
    );

    await expect(service.listPage('alpha', { limit: 50 })).rejects.toMatchObject({ code: 'errors.loadFailed' });
  });
});
