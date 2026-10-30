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

const { searchContactsForPicker } = await import('./actions');

const ROWS = [{ id: 'c1', display_name: 'Ivan Ivanov', company_name: null, type: 'person' }];

describe('searchContactsForPicker', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker', tables: { contacts: ROWS } });
  });

  it('returns matching contacts for any member, scoped to their agency', async () => {
    const result = await searchContactsForPicker('Ivan');

    expect(result).toEqual({ success: true, data: ROWS });
    expect(fake.filters).toContainEqual({ table: 'contacts', column: 'agency_id', value: 'agency-1' });
    expect(fake.filters).toContainEqual({ table: 'contacts', column: 'status', value: 'active' });
  });

  it('accepts an empty query', async () => {
    const result = await searchContactsForPicker('   ');

    expect(result.success).toBe(true);
  });

  it('rejects an over-long query without touching the database', async () => {
    const result = await searchContactsForPicker('x'.repeat(101));

    expect(result.success).toBe(false);
    expect(fake.touchedTables).toEqual([]);
  });

  it('rejects a non-string query', async () => {
    const result = await searchContactsForPicker(undefined as unknown as string);

    expect(result.success).toBe(false);
    expect(fake.touchedTables).toEqual([]);
  });

  it('reports a failed search instead of throwing', async () => {
    fake = createFakeSupabase({ role: 'broker', failingTables: ['contacts'] });

    const result = await searchContactsForPicker('Ivan');

    expect(result.success).toBe(false);
  });
});
