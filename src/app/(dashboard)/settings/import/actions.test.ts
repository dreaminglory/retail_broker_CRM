import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

const commitBatch = vi.fn();
const saveMapping = vi.fn();
const createJob = vi.fn();
const getJob = vi.fn();
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
    saveMapping = saveMapping;
    createJob = createJob;
  },
}));
vi.mock('@/domain/imports/repository', () => ({
  ImportRepository: class {
    getJob = getJob;
  },
}));
vi.mock('../../notify-after', () => ({
  notifyAfterResponse: (work: (service: unknown) => Promise<void>) => {
    scheduled.push(() => work({ notifyImportCompleted }));
  },
}));

const { commitImportBatchAction, createImportJobAction, saveImportMappingAction } = await import('./actions');

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

const PROPERTY_JOB_INPUT = {
  file_name: 'properties-basic.csv',
  file_sha256: 'a'.repeat(64),
  file_size_bytes: 100,
  encoding: 'utf-8',
  delimiter: ',',
  headers: ['Тип имот', 'Населено място'],
  entity_type: 'property',
};

describe('property import actions', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'manager', userId: 'user-me', agencyId: 'agency-1' });
    saveMapping.mockReset();
    createJob.mockReset();
    getJob.mockReset();
    getJob.mockResolvedValue({ id: 'job-1', entity_type: 'property' });
  });

  it('creates a property job for a manager', async () => {
    createJob.mockResolvedValue({ jobId: 'job-1', previousJobs: [] });

    const result = await createImportJobAction(PROPERTY_JOB_INPUT);

    expect(result.success).toBe(true);
    expect(createJob).toHaveBeenCalledWith('agency-1', expect.objectContaining({ entity_type: 'property' }));
  });

  it('refuses a broker a property job', async () => {
    fake = createFakeSupabase({ role: 'broker', userId: 'user-me', agencyId: 'agency-1' });

    const create = await createImportJobAction(PROPERTY_JOB_INPUT);
    const save = await saveImportMappingAction('job-1', { type: 'Тип имот', settlement: 'Населено място' }, {});

    expect(create.success).toBe(false);
    expect(save.success).toBe(false);
    expect(createJob).not.toHaveBeenCalled();
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it('saves a property mapping with the property options', async () => {
    const result = await saveImportMappingAction(
      'job-1',
      { type: 'Тип имот', settlement: 'Населено място', area: null },
      { duplicate_strategy: 'create', default_assigned_to: null, date_format: 'dd.MM.yyyy' },
    );

    expect(result.success).toBe(true);
    expect(saveMapping).toHaveBeenCalledWith(
      'agency-1',
      'job-1',
      { type: 'Тип имот', settlement: 'Населено място', area: null },
      { duplicate_strategy: 'create', default_assigned_to: null, date_format: 'dd.MM.yyyy' },
    );
  });

  it('blocks a property mapping without the settlement, naming the missing field', async () => {
    const result = await saveImportMappingAction('job-1', { type: 'Тип имот', settlement: null }, {});

    expect(result).toMatchObject({ success: false, error: 'import.errors.missingSettlementMapping' });
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it('refuses property options that are not property options', async () => {
    const result = await saveImportMappingAction(
      'job-1',
      { type: 'Тип имот', settlement: 'Населено място' },
      { date_format: 'yyyy' },
    );

    expect(result).toMatchObject({ success: false, error: 'import.errors.invalidOptions' });
  });
});
