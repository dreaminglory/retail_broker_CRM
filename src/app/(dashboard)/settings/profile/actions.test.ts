import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: () => {} }) }));

const { updateDigestEnabledAction } = await import('./actions');

describe('updateDigestEnabledAction', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker', userId: 'user-me', tables: { profiles: { id: 'user-me' } } });
  });

  it("changes only the signed-in user's own profile", async () => {
    const result = await updateDigestEnabledAction(false);

    expect(result).toEqual({ success: true, data: undefined });
    expect(fake.writes).toEqual([{ table: 'profiles', op: 'update', values: { digest_enabled: false } }]);
    expect(fake.filters).toEqual([{ table: 'profiles', column: 'id', value: 'user-me' }]);
  });

  it('refuses a caller with no session, without touching profiles', async () => {
    fake = createFakeSupabase({ role: 'broker', signedOut: true });

    const result = await updateDigestEnabledAction(false);

    expect(result).toEqual({ success: false, error: 'errors.unauthorized' });
    expect(fake.touchedTables).not.toContain('profiles');
  });

  it('refuses a value that is not a boolean, without touching profiles', async () => {
    const result = await updateDigestEnabledAction('false' as unknown as boolean);

    expect(result.success).toBe(false);
    expect(fake.touchedTables).not.toContain('profiles');
  });

  it('returns an error instead of throwing when the save fails', async () => {
    fake = createFakeSupabase({ role: 'broker', failingTables: ['profiles'] });

    const result = await updateDigestEnabledAction(true);

    expect(result).toEqual({ success: false, error: 'errors.saveFailed' });
  });
});
