import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

const commitBatch = vi.fn();
const notifyImportCompleted = vi.fn();
let scheduled: Array<() => Promise<void>> = [];

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/domain/imports/service', () => ({
  ImportService: class {
    commitBatch = commitBatch;
  },
}));
vi.mock('../../notify-after', () => ({
  notifyAfterResponse: (work: (service: unknown) => Promise<void>) => {
    scheduled.push(() => work({ notifyImportCompleted }));
  },
}));

const { commitImportBatchAction } = await import('./actions');

describe('commitImportBatchAction', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'owner', userId: 'user-me', agencyId: 'agency-1' });
    scheduled = [];
    commitBatch.mockReset();
    notifyImportCompleted.mockReset();
  });

  it('sends the summaries once the last batch is in, leaving out the importer', async () => {
    commitBatch.mockResolvedValue({ processed: 5, remaining: 0 });

    const result = await commitImportBatchAction('job-1');
    for (const work of scheduled) await work();

    expect(result).toEqual({ success: true, data: { processed: 5, remaining: 0 } });
    expect(notifyImportCompleted).toHaveBeenCalledWith({ agencyId: 'agency-1', jobId: 'job-1', actorId: 'user-me' });
  });

  it('sends nothing while rows remain', async () => {
    commitBatch.mockResolvedValue({ processed: 200, remaining: 5 });

    await commitImportBatchAction('job-1');

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when the batch fails', async () => {
    commitBatch.mockRejectedValue(new Error('refused'));

    const result = await commitImportBatchAction('job-1');

    expect(result.success).toBe(false);
    expect(scheduled).toHaveLength(0);
  });

  it('refuses a broker before committing anything', async () => {
    fake = createFakeSupabase({ role: 'broker', userId: 'user-me', agencyId: 'agency-1' });

    const result = await commitImportBatchAction('job-1');

    expect(result.success).toBe(false);
    expect(commitBatch).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });
});
