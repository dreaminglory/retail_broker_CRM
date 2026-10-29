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

const { mergeContactsAction, getMergePreviewAction, searchContactsForMergeAction } = await import('./merge-actions');

const WINNER_ID = '33333333-3333-4333-8333-333333333331';
const LOSER_ID = '33333333-3333-4333-8333-333333333332';

describe('contact merge actions (AD-045)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker' });
  });

  it('refuses a broker merging contacts, without touching any table', async () => {
    const result = await mergeContactsAction(WINNER_ID, LOSER_ID);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).toEqual([]);
  });

  it('refuses a broker previewing a merge', async () => {
    const result = await getMergePreviewAction(WINNER_ID, LOSER_ID);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).toEqual([]);
  });

  it('refuses a broker searching for a merge target', async () => {
    const result = await searchContactsForMergeAction('Ivan', LOSER_ID);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).toEqual([]);
  });

  it('lets a manager merge contacts', async () => {
    fake = createFakeSupabase({
      role: 'manager',
      tables: { contacts: { id: WINNER_ID, display_name: 'Ivan', contact_methods: [] } },
    });

    const result = await mergeContactsAction(WINNER_ID, LOSER_ID);

    expect(result).toEqual({ success: true, data: undefined });
    expect(fake.touchedTables).toContain('merge_history');
  });

  it('returns an error result instead of throwing when the user is signed out', async () => {
    fake = createFakeSupabase({ role: 'manager' });
    (fake.client as { auth: { getUser: () => Promise<unknown> } }).auth.getUser = async () => ({
      data: { user: null },
      error: null,
    });

    const result = await mergeContactsAction(WINNER_ID, LOSER_ID);

    expect(result).toEqual({ success: false, error: 'errors.unauthorized' });
  });
});
