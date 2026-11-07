import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { searchOpportunitiesQuickAction } = await import('./actions');

describe('searchOpportunitiesQuickAction', () => {
  it('reads through smart_list_opportunities, as the list does (one search rule)', async () => {
    fake = createFakeSupabase({ role: 'broker' });

    expect(await searchOpportunitiesQuickAction('Lozenets')).toEqual([]);
    expect(fake.touchedTables).toContain('rpc:smart_list_opportunities');
    expect(fake.touchedTables).not.toContain('opportunities');
  });

  it('skips a query under two characters', async () => {
    fake = createFakeSupabase({ role: 'broker' });

    expect(await searchOpportunitiesQuickAction('L')).toEqual([]);
    expect(fake.touchedTables.filter((t) => t.startsWith('rpc:'))).toEqual([]);
  });
});
