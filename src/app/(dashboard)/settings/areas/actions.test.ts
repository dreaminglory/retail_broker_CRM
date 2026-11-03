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

const { createAreaAction, updateAreaAction, reorderAreasAction } = await import('./actions');

const AREA_ID = '22222222-2222-4222-8222-222222222222';
const SETTLEMENT_ID = '33333333-3333-4333-8333-333333333333';

function areaForm(name: string) {
  const formData = new FormData();
  formData.set('settlement_id', SETTLEMENT_ID);
  formData.set('name', name);
  return formData;
}

describe('area actions (T6, AD-045)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker' });
  });

  it('refuses a broker adding an area, without touching areas', async () => {
    const result = await createAreaAction({ success: true, data: undefined }, areaForm('Лозенец'));

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('areas');
  });

  it('lets a manager add an area', async () => {
    fake = createFakeSupabase({ role: 'manager', tables: { areas: [] } });

    const result = await createAreaAction({ success: true, data: undefined }, areaForm('Лозенец'));

    expect(result).toEqual({ success: true, data: undefined });
    expect(fake.writes).toContainEqual(
      expect.objectContaining({
        table: 'areas',
        op: 'insert',
        values: expect.objectContaining({ name: 'Лозенец', agency_id: 'agency-1' }),
      }),
    );
  });

  it('refuses a broker renaming or deactivating an area', async () => {
    const formData = new FormData();
    formData.set('is_active', 'false');

    const result = await updateAreaAction(AREA_ID, { success: true, data: undefined }, formData);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('areas');
  });

  it('refuses a broker reordering areas', async () => {
    const result = await reorderAreasAction([{ id: AREA_ID, sort_order: 0 }]);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('areas');
  });
});
