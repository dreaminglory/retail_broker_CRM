import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fake-supabase';
import { ImportService } from './service';

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

    await expect(new ImportService(client as SupabaseClient).validate('agency-1', 'job-1')).rejects.toMatchObject({
      code: 'errors.loadFailed',
    });
  });
});
