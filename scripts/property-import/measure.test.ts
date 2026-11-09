/**
 * Rule 11 scale run (spec: property-import, Task 7): stages, validates, previews and commits
 * the 2,000-row file through ImportService on the local stack as owner@alpha.bg, prints the
 * timings, then reverts and cleans up. Skipped unless asked for:
 *
 *   PROPERTY_IMPORT_SCALE=1 npm run test:services -- scripts/property-import/measure.test.ts
 *
 * A vitest file rather than a tsx script: it needs the `@/` aliases and the test client, and
 * the repo has no TypeScript runner. Timings are reported, not asserted (Checkpoint 1 reads
 * them); the counts are asserted.
 */
import Papa from 'papaparse';
import { afterAll, expect, it } from 'vitest';
import { detectHeaders } from '@/domain/imports/csv/header-detection';
import { ImportService } from '@/domain/imports/service';
import { createRowCleanup, describeServices, signInAs } from '@/test/supabase-test-client';
import { scaleCsv } from './generate-scale';

const ROWS = Number(process.env.PROPERTY_IMPORT_SCALE_ROWS ?? 2000);
const describeScale = process.env.PROPERTY_IMPORT_SCALE ? describeServices : describeServices.skip;

describeScale('Property import scale run', () => {
  const cleanup = createRowCleanup();
  afterAll(() => cleanup.run());

  it(`imports ${ROWS} rows within rule 11`, { timeout: 15 * 60_000 }, async () => {
    const owner = await signInAs('owner@alpha.bg');
    const imports = new ImportService(owner.db);
    const csv = scaleCsv(ROWS);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields ?? [];
    const time = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
      const start = performance.now();
      const result = await fn();
      return [result, (performance.now() - start) / 1000];
    };

    const { jobId } = await imports.createJob(owner.agencyId, {
      file_name: 'properties-scale.csv', file_sha256: '5'.repeat(64), file_size_bytes: Buffer.byteLength(csv),
      encoding: 'utf-8', delimiter: ',', entity_type: 'property', headers,
    });
    cleanup.track('import_jobs', jobId);
    await imports.saveMapping(owner.agencyId, jobId, detectHeaders(headers, 'property'), { duplicate_strategy: 'skip' });

    const [, stageSeconds] = await time(async () => {
      for (let i = 0; i < parsed.data.length; i += 500) {
        await imports.stageRows(owner.agencyId, jobId, { startRow: i + 1, rows: parsed.data.slice(i, i + 500) });
      }
    });
    const [summary, validateSeconds] = await time(() => imports.validate(owner.agencyId, jobId, owner.userId));
    // The preview reads every row once, in 1,000-row pages (PostgREST's cap).
    const [previewed, previewSeconds] = await time(async () => {
      let read = 0;
      for (let from = 0; from < ROWS; from += 1000) {
        const { data, error } = await owner.db.from('import_rows').select('*').eq('import_job_id', jobId)
          .order('row_number').range(from, from + 999);
        if (error) throw error;
        read += data.length;
      }
      return read;
    });
    const [batches, commitSeconds] = await time(async () => {
      let calls = 0;
      while ((await imports.commitBatch(owner.agencyId, jobId)).remaining > 0) calls++;
      return calls + 1;
    });

    const { data: job } = await owner.db.from('import_jobs').select('created_count, error_count').eq('id', jobId).single();
    const [reverted, revertSeconds] = await time(() => imports.revert(owner.agencyId, jobId));

    const report = {
      rows: ROWS,
      stage_s: +stageSeconds.toFixed(1),
      validate_s: +validateSeconds.toFixed(1),
      preview_s: +previewSeconds.toFixed(1),
      validate_plus_preview_s: +(validateSeconds + previewSeconds).toFixed(1),
      commit_s: +commitSeconds.toFixed(1),
      commit_batches: batches,
      revert_s: +revertSeconds.toFixed(1),
      rule_11: {
        validate_and_preview_under_30s: validateSeconds + previewSeconds < 30,
        commit_under_2min: commitSeconds < 120,
      },
    };
    console.log(`PROPERTY_IMPORT_SCALE ${JSON.stringify(report)}`);

    expect(summary).toMatchObject({ total: ROWS, valid: ROWS });
    expect(previewed).toBe(ROWS);
    expect(job).toEqual({ created_count: ROWS, error_count: 0 });
    expect(reverted.deleted.properties).toBe(ROWS);
  });
});
