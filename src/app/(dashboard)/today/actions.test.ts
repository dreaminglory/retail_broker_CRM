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

const assigneeFilters = () =>
  fake.filters.filter((f) => f.column === 'assigned_to' && ['tasks', 'opportunities', 'inquiries'].includes(f.table));

describe('Today scope (AD-044)', () => {
  it("shows a manager only their own work by default (AC-6.2-4)", async () => {
    signIn('manager');
    const result = await getTodayScreenData();
    expect(result).toMatchObject({ success: true, data: { scope: 'mine' } });
    expect(assigneeFilters().length).toBeGreaterThan(0);
    expect(assigneeFilters().every((f) => f.value === 'user-1')).toBe(true);
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
    expect(assigneeFilters().every((f) => f.value === 'user-1')).toBe(true);
    expect(assigneeFilters().length).toBeGreaterThan(0);
  });
});
