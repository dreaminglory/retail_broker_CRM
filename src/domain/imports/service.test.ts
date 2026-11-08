import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fake-supabase';
import { describeRowError, ImportService } from './service';

vi.mock('../members/repository', () => ({
  MemberRepository: class {
    getActiveBrokers = async () => [];
  },
}));

const INQUIRY_JOB = { id: 'job-1', agency_id: 'agency-1', entity_type: 'inquiry', status: 'staged', options: {}, column_mapping: {} };

describe('ImportService.validate', () => {
  it('stops when the lead sources fail to load, rather than treating every source as unknown', async () => {
    const { client } = createFakeSupabase({
      role: 'owner',
      tables: { import_jobs: INQUIRY_JOB },
      failingTables: ['lead_sources'],
    });

    await expect(new ImportService(client as SupabaseClient).validate('agency-1', 'job-1', 'user-1')).rejects.toMatchObject({
      code: 'errors.loadFailed',
    });
  });
});

describe('describeRowError', () => {
  const reason = (code: string) => `[${code}]`;

  it('adds the detail, such as the candidate municipalities', () => {
    expect(describeRowError({ field: 'settlement', code: 'import.errors.settlementAmbiguous', detail: 'Столична, Любимец' }, reason))
      .toBe('[import.errors.settlementAmbiguous] (Столична, Любимец)');
    expect(describeRowError({ field: 'type', code: 'import.errors.invalidPrice' }, reason)).toBe('[import.errors.invalidPrice]');
  });

  it('never shows the raw database message of a failed write', () => {
    expect(describeRowError({ field: 'row', code: 'import.errors.dbWrite', detail: 'violates check constraint "x"' }, reason))
      .toBe('[import.errors.dbWrite]');
  });
});
