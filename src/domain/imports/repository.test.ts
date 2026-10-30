import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import { ImportRepository } from './repository';
import type { ImportRow } from './types';
import type { CreateImportJobInput } from './validation';

function failingOn(table: string) {
  const { client } = createFakeSupabase({ role: 'owner', failingTables: [table] });
  return new ImportRepository(client as SupabaseClient);
}

const JOB_INPUT = { file_name: 'a.csv', headers: [] } as unknown as CreateImportJobInput;

describe('ImportRepository errors', () => {
  it.each<[string, string, (repo: ImportRepository) => Promise<unknown>]>([
    ['getJob', 'import_jobs', (repo) => repo.getJob('a', 'j')],
    ['listJobs', 'import_jobs', (repo) => repo.listJobs('a')],
    ['findJobsByHash', 'import_jobs', (repo) => repo.findJobsByHash('a', 'h')],
    ['listRows', 'import_rows', (repo) => repo.listRows('a', 'j')],
    ['lookupExistingMethods', 'contact_methods', (repo) => repo.lookupExistingMethods('a', ['v'])],
    ['lookupExternalRefs', 'contacts', (repo) => repo.lookupExternalRefs('a', ['r'])],
    ['lookupContactsByName', 'contacts', (repo) => repo.lookupContactsByName('a', ['n'])],
    ['lookupInquiryExternalRefs', 'inquiries', (repo) => repo.lookupInquiryExternalRefs('a', null, ['r'])],
  ])('a failed %s is errors.loadFailed', async (_name, table, call) => {
    const error = (await call(failingOn(table)).catch((e) => e)) as DomainError;

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.loadFailed');
  });

  it.each<[string, string, (repo: ImportRepository) => Promise<unknown>]>([
    ['createJob', 'import_jobs', (repo) => repo.createJob('a', JOB_INPUT)],
    ['updateJob', 'import_jobs', (repo) => repo.updateJob('a', 'j', {})],
    ['insertRows', 'import_rows', (repo) => repo.insertRows('a', 'j', [])],
    ['commitContactsBatch', 'rpc:import_commit_contacts', (repo) => repo.commitContactsBatch('j')],
    ['commitInquiriesBatch', 'rpc:import_commit_inquiries', (repo) => repo.commitInquiriesBatch('j')],
    ['revertJob', 'rpc:import_revert', (repo) => repo.revertJob('j')],
  ])('a failed %s is errors.saveFailed', async (_name, table, call) => {
    const error = (await call(failingOn(table)).catch((e) => e)) as DomainError;

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.saveFailed');
  });

  it('keeps the database message for the log', async () => {
    const error = await failingOn('import_jobs').getJob('a', 'j').catch((e) => e);

    expect(error.message).toContain('connection reset');
  });
});

describe('ImportRepository.updateRowsBulk', () => {
  const ROW = { id: 'r', status: 'valid', normalized: {}, errors: [], match_reason: null, matched_entity_id: null } as unknown as ImportRow;

  it('a failed row update is errors.saveFailed, not a validated row that kept its old status', async () => {
    const error = await failingOn('import_rows').updateRowsBulk('a', 'j', [ROW]).catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.saveFailed');
  });
});
