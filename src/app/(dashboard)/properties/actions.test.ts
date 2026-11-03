import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const { deletePropertyAction } = await import('./actions');

const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

describe('deletePropertyAction (T2)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker' });
  });

  it('refuses a broker before touching properties', async () => {
    expect(await deletePropertyAction(PROPERTY_ID)).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('properties');
  });
});
