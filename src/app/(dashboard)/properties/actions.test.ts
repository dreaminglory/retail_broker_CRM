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

const {
  changeListingPriceAction,
  deletePropertyAction,
  endPropertyPartyAction,
  setListingStatusAction,
  setPropertyArchivedAction,
  updatePropertyAction,
} = await import('./actions');

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

describe('property actions with a malformed id', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'owner' });
  });

  const notFound = { success: false, error: 'errors.not_found' };
  const form = () => new FormData();

  it.each([
    ['updatePropertyAction', () => updatePropertyAction('bad', { success: false, error: '' }, form())],
    ['setPropertyArchivedAction', () => setPropertyArchivedAction('bad', true)],
    ['deletePropertyAction', () => deletePropertyAction('bad')],
    ['changeListingPriceAction', () => changeListingPriceAction('bad', PROPERTY_ID, { success: false, error: '' }, form())],
    ['setListingStatusAction', () => setListingStatusAction('bad', PROPERTY_ID, 'closed')],
    ['endPropertyPartyAction', () => endPropertyPartyAction('bad', PROPERTY_ID)],
  ])('%s answers not found without a query', async (_name, run) => {
    expect(await run()).toEqual(notFound);
    expect(fake.touchedTables).toEqual([]);
  });
});
