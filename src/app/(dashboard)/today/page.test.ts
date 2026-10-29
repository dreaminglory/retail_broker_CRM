import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

// The fake answers every agency_memberships query with the caller's membership.
vi.mock('@/domain/members/repository', () => ({
  MemberRepository: class {
    getActiveBrokers = async () => [];
  },
}));

const { default: TodayPage } = await import('./page');

describe('Today page', () => {
  it('shows a database failure as an error, not as a sign-out', async () => {
    fake = createFakeSupabase({
      role: 'broker',
      tables: { agencies: { settings: { timezone: 'Europe/Sofia' } } },
      failingTables: ['tasks'],
    });

    await expect(TodayPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(/Failed to fetch tasks/);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to sign in', async () => {
    fake = createFakeSupabase({ role: 'broker', signedOut: true });

    await expect(TodayPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT /login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
