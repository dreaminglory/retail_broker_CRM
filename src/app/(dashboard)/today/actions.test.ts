import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

const { getTodayScreenData } = await import('./actions');

function signIn(role: string) {
  fake = createFakeSupabase({ role, userId: 'user-1', tables: { agencies: { settings: { timezone: 'Europe/Sofia' } } } });
}

const TODAY_TABLES = ['tasks', 'opportunities', 'inquiries'];

const assigneeFilters = () =>
  fake.filters.filter((f) => f.column === 'assigned_to' && TODAY_TABLES.includes(f.table));

/** Every Today query (tasks, at-risk opportunities, new inquiries) is filtered to the user. */
function expectOnlyOwnWork() {
  for (const table of TODAY_TABLES) {
    const filters = assigneeFilters().filter((f) => f.table === table);
    expect(filters, table).not.toEqual([]);
    expect(filters.every((f) => f.value === 'user-1'), table).toBe(true);
  }
}

describe('Today scope (AD-044)', () => {
  it("shows a manager only their own work by default (AC-6.2-4)", async () => {
    signIn('manager');
    const result = await getTodayScreenData();
    expect(result).toMatchObject({ success: true, data: { scope: 'mine' } });
    expectOnlyOwnWork();
  });

  it("shows a manager everyone's work with scope=agency", async () => {
    signIn('manager');
    const result = await getTodayScreenData('agency');
    expect(result).toMatchObject({ success: true, data: { scope: 'agency' } });
    expect(assigneeFilters()).toEqual([]);
  });

  it('keeps a broker on their own work even when asking for the agency', async () => {
    signIn('broker');
    const result = await getTodayScreenData('agency');
    expect(result).toMatchObject({ success: true, data: { scope: 'mine' } });
    expectOnlyOwnWork();
  });
});
