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

const { completeTaskAction, cancelTaskAction } = await import('./actions');

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const OPP_ID = '22222222-2222-4222-8222-222222222222';
const STAGE_ID = '33333333-3333-4333-8333-333333333333';

function withTask(status: 'pending' | 'completed', timezone = 'Europe/Sofia') {
  fake = createFakeSupabase({
    role: 'broker',
    tables: {
      agencies: { settings: { timezone } },
      tasks: { id: TASK_ID, status, opportunity_id: OPP_ID, assigned_to: 'user-1' },
    },
  });
}

describe('opportunity page task actions', () => {
  beforeEach(() => withTask('pending'));

  it('completing with a next task and a stage creates the task and moves the stage (AC-6.2-2)', async () => {
    const result = await completeTaskAction(TASK_ID, {
      outcome: 'Spoke with the buyer',
      next_task: { title: 'Viewing', task_type: 'viewing', due_at: '2026-01-20T14:00' },
      new_stage_id: STAGE_ID,
    });

    expect(result.success).toBe(true);
    expect(fake.writes).toEqual([
      expect.objectContaining({ table: 'tasks', op: 'update', values: expect.objectContaining({ status: 'completed', outcome: 'Spoke with the buyer' }) }),
      expect.objectContaining({
        table: 'tasks',
        op: 'insert',
        values: expect.objectContaining({ title: 'Viewing', opportunity_id: OPP_ID, due_at: '2026-01-20T12:00:00.000Z' }),
      }),
      { table: 'opportunities', op: 'update', values: { stage_id: STAGE_ID } },
    ]);
  });

  it("reads the next task's due date in the agency's own timezone", async () => {
    withTask('pending', 'Europe/London');
    await completeTaskAction(TASK_ID, { outcome: 'Spoke', next_task: { title: 'Call', due_at: '2026-01-20T14:00' } });
    const insert = fake.writes.find((w) => w.op === 'insert');
    expect(insert?.values).toMatchObject({ due_at: '2026-01-20T14:00:00.000Z' });
  });

  it('returns the translated refusal for a task that is no longer pending', async () => {
    withTask('completed');
    const result = await cancelTaskAction(TASK_ID, { reason: 'Duplicate' });
    expect(result).toEqual({ success: false, error: 'errors.task_not_pending' });
    expect(fake.writes).toEqual([]);
  });
});
