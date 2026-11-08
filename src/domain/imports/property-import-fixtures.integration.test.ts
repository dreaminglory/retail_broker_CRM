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
    const { data: areas } = await owner.db.from('areas').select('id').eq('import_job_id', jobId);
    const { data: contacts } = await owner.db.from('contacts').select('id').eq('import_job_id', jobId);
    const { data: props } = await owner.db.from('properties').select('id').eq('import_job_id', jobId);
    // Tracked in case the revert keeps something; cleanup runs in reverse, properties first.
    areas!.forEach((a) => cleanup.track('areas', a.id));
    contacts!.forEach((c) => cleanup.track('contacts', c.id));
    props!.forEach((p) => cleanup.track('properties', p.id));
    const reverted = await imports.revert(owner.agencyId, jobId);
    return { job, reverted, created: { areas: areas!.length, contacts: contacts!.length } };
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
});
