import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { detectEncoding } from './csv/detect-encoding';
import { detectHeaders } from './csv/header-detection';
import type { NormalizedPropertyRow } from './property-validation';
import { ImportService } from './service';
import type { ImportRow } from './types';

// spec: property-import, Task 7. The fixtures through the whole pipeline, read as the wizard
// reads a file: encoding detected from the bytes, Papa with headers, 500-row chunks.

const FIXTURES = join(__dirname, '__fixtures__');

describeServices('Property import fixtures against the local stack', () => {
  const cleanup = createRowCleanup();
  let owner: TestSession;
  let imports: ImportService;

  beforeAll(async () => {
    owner = await signInAs('owner@alpha.bg');
    imports = new ImportService(owner.db);
  });

  afterAll(() => cleanup.run());

  async function stageFixture(name: string) {
    const bytes = readFileSync(join(FIXTURES, name));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const encoding = detectEncoding(buffer);
    const text = new TextDecoder(encoding).decode(buffer);
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields ?? [];

    const { jobId } = await imports.createJob(owner.agencyId, {
      file_name: name,
      file_sha256: 'f'.repeat(64),
      file_size_bytes: bytes.byteLength,
      encoding,
      delimiter: ',',
      entity_type: 'property',
      headers,
    });
    cleanup.track('import_jobs', jobId);
    const mapping = detectHeaders(headers, 'property');
    await imports.saveMapping(owner.agencyId, jobId, mapping, { duplicate_strategy: 'skip' });
    for (let i = 0; i < parsed.data.length; i += 500) {
      await imports.stageRows(owner.agencyId, jobId, { startRow: i + 1, rows: parsed.data.slice(i, i + 500) });
    }
    return { jobId, encoding, mapping, rowCount: parsed.data.length };
  }

  async function rowsOf(jobId: string): Promise<ImportRow[]> {
    const { data } = await owner.db.from('import_rows').select('*').eq('import_job_id', jobId).order('row_number');
    return data as ImportRow[];
  }

  async function commitAndRevert(jobId: string) {
    for (let i = 0; i < 50; i++) {
      if ((await imports.commitBatch(owner.agencyId, jobId)).remaining === 0) break;
    }
    const { data: job } = await owner.db.from('import_jobs').select('status, created_count').eq('id', jobId).single();
    const result = await imports.getResult(owner.agencyId, jobId);
    const { data: areas } = await owner.db.from('areas').select('id').eq('import_job_id', jobId);
    const { data: contacts } = await owner.db.from('contacts').select('id').eq('import_job_id', jobId);
    const { data: props } = await owner.db.from('properties').select('id').eq('import_job_id', jobId);
    // Tracked in case the revert keeps something; cleanup runs in reverse, properties first.
    areas!.forEach((a) => cleanup.track('areas', a.id));
    contacts!.forEach((c) => cleanup.track('contacts', c.id));
    props!.forEach((p) => cleanup.track('properties', p.id));
    const reverted = await imports.revert(owner.agencyId, jobId);
    return { job, result, reverted, created: { areas: areas!.length, contacts: contacts!.length } };
  }

  it.each(['properties-basic.csv', 'properties-basic-cp1251.csv'])(
    '%s maps every column, validates, commits 20 properties and reverts them all',
    async (name) => {
      const { jobId, encoding, mapping, rowCount } = await stageFixture(name);
      expect(encoding).toBe(name.includes('1251') ? 'windows-1251' : 'utf-8');
      expect(rowCount).toBe(20);
      expect(Object.keys(mapping).sort()).toEqual([
        'address', 'area', 'area_m2', 'assigned_to', 'construction', 'description', 'external_ref',
        'floor', 'floors_total', 'listed_at', 'listing_status', 'municipality', 'owner_email',
        'owner_name', 'owner_phone', 'plot_m2', 'rent_price', 'rooms', 'sale_price', 'settlement',
        'type', 'year_built',
      ]);

      const summary = await imports.validate(owner.agencyId, jobId, owner.userId);
      const rows = await rowsOf(jobId);
      expect(rows.filter((r) => r.status !== 'valid').map((r) => [r.row_number, r.errors])).toEqual([]);
      expect(summary).toMatchObject({ total: 20, valid: 20 });

      const first = rows[0].normalized as unknown as NormalizedPropertyRow;
      expect(first.property).toMatchObject({
        type: 'apartment', rooms: 2, area_m2: 68, floor: 3, floors_total: 6, construction: 'brick', year_built: 2008,
      });

      const { job, reverted, created } = await commitAndRevert(jobId);
      expect(job).toEqual({ status: 'completed', created_count: 20 });
      // One new area (Витоша, three spellings), four new owners (one of them on two rows).
      expect(created).toEqual({ areas: 1, contacts: 4 });
      expect(reverted).toEqual({
        deleted: { contacts: 4, inquiries: 0, properties: 20, areas: 1 },
        kept: { contacts: 0, inquiries: 0, properties: 0, areas: 0 },
      });
    }
  );

  it('gives every edge-case row its expected outcome', async () => {
    const { jobId } = await stageFixture('properties-edge.csv');
    const summary = await imports.validate(owner.agencyId, jobId, owner.userId);
    const rows = await rowsOf(jobId);

    const outcome = (r: ImportRow) => [r.row_number, r.status, r.match_reason ?? r.errors[0]?.code ?? null];
    expect(rows.map(outcome)).toEqual([
      [1, 'invalid', 'import.errors.settlementAmbiguous'], // "с. Лозен", several municipalities
      [2, 'valid', null], //                                  Лозен + Столична
      [3, 'valid', null], //                                  EKATTE 44077
      [4, 'valid', null], //                                  1 200 лв.
      [5, 'valid', null], //                                  двустаен
      [6, 'valid', null], //                                  партер
      [7, 'valid', null], //                                  new area Бояна
      [8, 'valid', null], //                                  new owner …
      [9, 'valid', null], //                                  … shared with row 8
      [10, 'duplicate', 'address'], //                        seeded Alpha property's address
      [11, 'valid', null],
      [12, 'duplicate', 'in_file'], //                        same key as row 11
      [13, 'invalid', 'import.errors.ownerPhoneInvalid'],
      [14, 'valid', null], //                                 plot with rooms: cleared, as the form does
      [15, 'invalid', 'validation.plot_m2_required'],
      [16, 'invalid', 'validation.rooms_required'],
      [17, 'invalid', 'import.errors.settlementNotFound'],
      [18, 'skipped', 'external_ref'], //                     EDGE-02 again
      [19, 'valid', null], //                                 owner phone of seeded Ivan Ivanov
      [20, 'invalid', 'import.errors.unknownAssignee'],
      [21, 'invalid', 'import.errors.invalidPrice'],
      [22, 'valid', null], //                                 owner phone only, not a contact: no owner, a warning
    ]);
    expect(summary).toMatchObject({ total: 22, valid: 12, invalid: 7, duplicate: 2 });

    const n = rows.map((r) => r.normalized as unknown as NormalizedPropertyRow & {
      owner_contact_id?: string | null;
      new_owner?: unknown;
      warnings?: unknown[];
    });
    expect(n[21]).toMatchObject({
      owner_contact_id: null,
      new_owner: null,
      warnings: [{ field: 'owner_name', code: 'import.warnings.ownerSkippedNoName' }],
    });
    expect(n[1].warnings).toEqual([]);
    expect(n[3]).toMatchObject({ bgn_converted: true, listings: [{ offer_type: 'rent', price: 613.55 }] });
    expect(n[4].property).toMatchObject({ type: 'apartment', rooms: 2 });
    expect(n[5].property.floor).toBe(0);
    expect(n[6].new_area).toMatchObject({ name: 'Бояна' });
    expect(n[13].property).toMatchObject({ type: 'plot', rooms: null, floor: null, plot_m2: 600 });
    expect(n[18].owner_contact_id).toEqual(expect.any(String));

    const { job, reverted, created } = await commitAndRevert(jobId);
    expect(job).toEqual({ status: 'completed', created_count: 12 });
    // Rows 8 and 9 share one new owner; row 19's owner existed before and stays; row 22 makes none.
    expect(created).toEqual({ areas: 1, contacts: 1 });
    expect(reverted).toEqual({
      deleted: { contacts: 1, inquiries: 0, properties: 12, areas: 1 },
      kept: { contacts: 0, inquiries: 0, properties: 0, areas: 0 },
    });
  });

  // Task 9: what the preview shows, read back from the validated rows.
  it('previews the edge-case file with the same counts as the expected table', async () => {
    const { jobId } = await stageFixture('properties-edge.csv');
    await imports.validate(owner.agencyId, jobId, owner.userId);

    const preview = await imports.getPropertyPreview(owner.agencyId, jobId);

    expect(preview.counts).toEqual({ new: 12, duplicate: 2, invalid: 7, skipped: 1 });
    expect(preview.newAreas).toEqual([
      expect.objectContaining({ name: 'Бояна', settlementName: 'София', rows: 1, checked: true }),
    ]);
    expect(preview.bgnConverted).toBe(1);
    // Row 19's owner exists; rows 8 and 9 share one new owner.
    expect(preview.owners).toEqual({ matched: 1, created: 1 });
    expect(preview.rows).toHaveLength(22);
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 1,
      status: 'invalid',
      label: 'гараж, с. Лозен, ул. Ръб 1',
      errors: [expect.objectContaining({ code: 'import.errors.settlementAmbiguous' })],
    });
    expect(preview.rows[21].warnings).toEqual([{ field: 'owner_name', code: 'import.warnings.ownerSkippedNoName' }]);
  });

  it('imports the rows of an unticked new area without one, as saved from the preview', async () => {
    const { jobId } = await stageFixture('properties-basic.csv');
    await imports.validate(owner.agencyId, jobId, owner.userId);
    const preview = await imports.getPropertyPreview(owner.agencyId, jobId);
    const vitosha = preview.newAreas.find((a) => a.name.toLowerCase() === 'витоша');
    expect(vitosha).toMatchObject({ rows: 3, checked: true });

    await imports.setCreateAreas(owner.agencyId, jobId, preview.newAreas.filter((a) => a !== vitosha).map((a) => a.key));
    expect((await imports.getPropertyPreview(owner.agencyId, jobId)).newAreas.find((a) => a.key === vitosha!.key)?.checked).toBe(false);

    const { job, result, created } = await commitAndRevert(jobId);
    expect(job).toEqual({ status: 'completed', created_count: 20 });
    // What the wizard's last step shows.
    expect(result).toEqual({ created: 20, skipped: 0, errors: 0 });
    expect(created.areas).toBe(0);
  });

  it('refuses to change the kept areas of a job that is not a validated property job', async () => {
    const { jobId } = await stageFixture('properties-basic.csv');
    await expect(imports.setCreateAreas(owner.agencyId, jobId, [])).rejects.toMatchObject({ code: 'import.errors.invalidStatus' });
  });

  it('lists every invalid row in the error report, past the first 1,000 rows, with its reason', async () => {
    const headers = ['Тип имот', 'Населено място', 'Адрес', 'Квадратура', 'Продажна цена'];
    const data = Array.from({ length: 1050 }, (_, i) => ({
      'Тип имот': 'гараж',
      'Населено място': i === 4 || i === 1049 ? 'Атлантида' : 'София',
      'Адрес': `ул. Отчет ${i + 1}`,
      'Квадратура': '18',
      'Продажна цена': '10000',
    }));
    const { jobId } = await imports.createJob(owner.agencyId, {
      file_name: 'report.csv', file_sha256: 'e'.repeat(64), file_size_bytes: 1, encoding: 'utf-8',
      delimiter: ',', entity_type: 'property', headers,
    });
    cleanup.track('import_jobs', jobId);
    await imports.saveMapping(owner.agencyId, jobId, detectHeaders(headers, 'property'), { duplicate_strategy: 'skip' });
    for (let i = 0; i < data.length; i += 500) {
      await imports.stageRows(owner.agencyId, jobId, { startRow: i + 1, rows: data.slice(i, i + 500) });
    }
    await imports.validate(owner.agencyId, jobId, owner.userId);

    const csv = await imports.buildErrorReportCsv(owner.agencyId, jobId, { reasonHeader: 'Причина', reason: (code) => `<${code}>` });
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('ул. Отчет 5');
    expect(lines[2]).toContain('ул. Отчет 1050');
    expect(lines[2]).toContain('<import.errors.settlementNotFound>');
  });
});
