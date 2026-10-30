import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContactService } from '@/domain/contacts/service';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { ImportService } from './service';

describeServices('ImportService against the local stack', () => {
  const cleanup = createRowCleanup();
  let owner: TestSession;
  let imports: ImportService;

  beforeAll(async () => {
    owner = await signInAs('owner@alpha.bg');
    imports = new ImportService(owner.db);
  });

  afterAll(() => cleanup.run());

  async function createJob(headers: string[] = ['Name']): Promise<string> {
    const { jobId } = await imports.createJob(owner.agencyId, {
      file_name: 'contacts.csv',
      file_sha256: 'a'.repeat(64),
      file_size_bytes: 100,
      encoding: 'utf-8',
      delimiter: ',',
      entity_type: 'contact',
      headers,
    });
    cleanup.track('import_jobs', jobId);
    return jobId;
  }

  async function insertRows(jobId: string, rows: Record<string, unknown>[]) {
    const { error } = await owner.db
      .from('import_rows')
      .insert(rows.map((row, i) => ({ agency_id: owner.agencyId, import_job_id: jobId, row_number: i + 1, raw: {}, errors: [], ...row })));
    if (error) throw new Error(`Could not insert import rows: ${error.message}`);
  }

  it('reverting keeps a contact someone has worked on, and deletes the untouched one (AC-8)', async () => {
    const jobId = await createJob();
    const contacts = new ContactService(owner.db);
    await insertRows(jobId, [
      { status: 'valid', normalized: { contact_type: 'person', first_name: 'Untouched' } },
      { status: 'valid', normalized: { contact_type: 'person', first_name: 'Worked' } },
    ]);
    const { error: jobError } = await owner.db.from('import_jobs').update({ status: 'validated' }).eq('id', jobId);
    expect(jobError).toBeNull();

    await imports.commitBatch(owner.agencyId, jobId);

    const { data: committed } = await owner.db
      .from('import_rows')
      .select('entity_id')
      .eq('import_job_id', jobId)
      .order('row_number');
    const [untouched, worked] = committed!.map((row) => ({ id: row.entity_id as string }));
    cleanup.track('contacts', untouched.id);
    cleanup.track('contacts', worked.id);

    const { data: note } = await owner.db
      .from('notes')
      .insert({ agency_id: owner.agencyId, contact_id: worked.id, content: 'Called them', created_by: owner.userId })
      .select('id')
      .single();
    cleanup.track('notes', note!.id);

    const result = await imports.revert(owner.agencyId, jobId);

    expect(result).toEqual({ deleted: { contacts: 1, inquiries: 0 }, kept: { contacts: 1, inquiries: 0 } });
    expect(await contacts.getById(untouched.id, owner.agencyId)).toBeNull();
    expect((await contacts.getById(worked.id, owner.agencyId))!.first_name).toBe('Worked');
    const { data: noteAfter } = await owner.db.from('notes').select('id').eq('id', note!.id);
    expect(noteAfter).toHaveLength(1);

    const { data: rows } = await owner.db
      .from('import_rows')
      .select('status')
      .eq('import_job_id', jobId)
      .order('row_number');
    expect(rows!.map((row) => row.status)).toEqual(['reverted', 'revert_skipped']);
  });

  it('builds the error report with the translated reasons, and quotes them', async () => {
    const jobId = await createJob(['Name', 'Phone']);
    await insertRows(jobId, [
      { status: 'invalid', raw: { Name: 'Ivan "Vanko"', Phone: 'abc' }, errors: [{ field: 'phone', code: 'bad_phone' }] },
      { status: 'valid', raw: { Name: 'Fine', Phone: '+359888111222' } },
    ]);

    const csv = await imports.buildErrorReportCsv(owner.agencyId, jobId, {
      reasonHeader: 'Причина',
      reason: (code) => `Translated "${code}"`,
    });

    expect(csv).toBe(
      '﻿"Name","Phone","Причина"\n"Ivan ""Vanko""","abc","Translated ""bad_phone"""\n'
    );
  });

  it('builds no report when no row failed', async () => {
    const jobId = await createJob();

    const csv = await imports.buildErrorReportCsv(owner.agencyId, jobId, {
      reasonHeader: 'Reason',
      reason: (code) => code,
    });

    expect(csv).toBe('');
  });

  it('says why when the job has not completed', async () => {
    const jobId = await createJob();

    await expect(imports.revert(owner.agencyId, jobId)).rejects.toMatchObject({
      code: 'import.errors.invalidStatus',
    });
  });

  it('says why when the revert window has passed', async () => {
    const jobId = await createJob();
    const { error } = await owner.db
      .from('import_jobs')
      .update({ status: 'completed', completed_at: new Date(Date.now() - 8 * 86_400_000).toISOString() })
      .eq('id', jobId);
    expect(error).toBeNull();

    await expect(imports.revert(owner.agencyId, jobId)).rejects.toMatchObject({
      code: 'import.errors.revertExpired',
    });
  });

  it("refuses another agency's job", async () => {
    const jobId = await createJob();
    const outsider = await signInAs('owner@beta.bg');
    const outsiderImports = new ImportService(outsider.db);

    await expect(outsiderImports.revert(owner.agencyId, jobId)).rejects.toMatchObject({
      code: 'import.errors.notFound',
    });
    await expect(outsiderImports.revert(outsider.agencyId, jobId)).rejects.toMatchObject({
      code: 'import.errors.notFound',
    });
  });
});
