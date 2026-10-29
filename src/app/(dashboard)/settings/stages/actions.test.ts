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

const { createStageAction, updateStageAction, reorderStagesAction, deleteStageAction } = await import('./actions');

const STAGE_ID = '11111111-1111-4111-8111-111111111111';

function stageForm(name: string) {
  const formData = new FormData();
  formData.set('name', name);
  formData.set('is_terminal', 'false');
  return formData;
}

describe('stage actions (AD-045)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker' });
  });

  it('refuses a broker creating a stage, without touching stages', async () => {
    const result = await createStageAction({ success: true, data: undefined }, stageForm('Viewing'));

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('stages');
  });

  it('lets a manager create a stage', async () => {
    fake = createFakeSupabase({ role: 'manager' });

    const result = await createStageAction({ success: true, data: undefined }, stageForm('Viewing'));

    expect(result).toEqual({ success: true, data: undefined });
    expect(fake.touchedTables).toContain('stages');
  });

  it('refuses a broker renaming a stage', async () => {
    const result = await updateStageAction(STAGE_ID, { success: true, data: undefined }, stageForm('Renamed'));

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('stages');
  });

  it('refuses a broker reordering stages', async () => {
    const result = await reorderStagesAction([{ id: STAGE_ID, sort_order: 1 }]);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('stages');
  });

  it('refuses a broker deleting a stage', async () => {
    const result = await deleteStageAction(STAGE_ID);

    expect(result).toEqual({ success: false, error: 'errors.forbidden' });
    expect(fake.touchedTables).not.toContain('stages');
  });
});
