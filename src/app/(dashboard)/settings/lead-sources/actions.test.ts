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

const { createLeadSourceAction, updateLeadSourceAction, deactivateLeadSourceAction } = await import('./actions');

const SOURCE_ID = '22222222-2222-4222-8222-222222222222';

function sourceForm(name: string) {
  const formData = new FormData();
  formData.set('name', name);
  formData.set('channel', 'portal');
  return formData;
}

describe('lead source actions (AD-045)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker' });
  });

  it('refuses a broker creating a lead source, without touching lead_sources', async () => {
    const result = await createLeadSourceAction({ success: true, data: undefined }, sourceForm('imot.bg'));

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('lead_sources');
  });

  it('lets an owner create a lead source', async () => {
    fake = createFakeSupabase({ role: 'owner' });

    const result = await createLeadSourceAction({ success: true, data: undefined }, sourceForm('imot.bg'));

    expect(result).toEqual({ success: true, data: undefined });
    expect(fake.touchedTables).toContain('lead_sources');
  });

  it('refuses a broker editing a lead source', async () => {
    const result = await updateLeadSourceAction(SOURCE_ID, { success: true, data: undefined }, sourceForm('Renamed'));

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('lead_sources');
  });

  it('refuses a broker deactivating a lead source', async () => {
    const result = await deactivateLeadSourceAction(SOURCE_ID);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('lead_sources');
  });
});
