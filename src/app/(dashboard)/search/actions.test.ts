import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));

const { globalSearchAction } = await import('./actions');

describe('globalSearchAction', () => {
  it('returns results in an ActionResult', async () => {
    fake = createFakeSupabase({ role: 'broker' });

    expect(await globalSearchAction('Ivan')).toEqual({ success: true, data: [] });
  });

  it('returns a translated error instead of throwing when a search fails', async () => {
    fake = createFakeSupabase({ role: 'broker', failingTables: ['contacts'] });

    expect(await globalSearchAction('Ivan')).toEqual({ success: false, error: 'errors.loadFailed' });
  });

  it('skips a query under two characters', async () => {
    fake = createFakeSupabase({ role: 'broker' });

    expect(await globalSearchAction('I')).toEqual({ success: true, data: [] });
    expect(fake.touchedTables).toEqual([]);
  });

  it('returns no results when signed out', async () => {
    fake = createFakeSupabase({ role: 'broker', signedOut: true });

    expect(await globalSearchAction('Ivan')).toEqual({ success: true, data: [] });
  });
});
