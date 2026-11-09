import { describe, expect, it } from 'vitest';
import { buildPropertyPreview, type PreviewInputRow } from './property-preview';

const SOFIA = 'sofia-id';
const PLOVDIV = 'plovdiv-id';

const mapping = { type: 'Тип', settlement: 'Град', address: 'Адрес' };

function row(n: number, status: PreviewInputRow['status'], normalized: Record<string, unknown> | null = null, extra: Partial<PreviewInputRow> = {}): PreviewInputRow {
  return {
    row_number: n,
    status,
    match_reason: null,
    errors: [],
    raw: { Тип: 'гараж', Град: 'София', Адрес: `ул. Тест ${n}` },
    normalized,
    ...extra,
  };
}

function valid(extra: Record<string, unknown> = {}) {
  return {
    new_area: null,
    bgn_converted: false,
    owner_contact_id: null,
    new_owner: null,
    warnings: [],
    ...extra,
  };
}

const vitosha = { settlement_id: SOFIA, name: 'Витоша', key: `${SOFIA}:витоша` };
const lozenek = { settlement_id: SOFIA, name: 'Лозенек', key: `${SOFIA}:лозенек` };
const trakia = { settlement_id: PLOVDIV, name: 'Тракия', key: `${PLOVDIV}:тракия` };

const context = {
  mapping,
  duplicateStrategy: 'skip' as const,
  createAreas: undefined,
  settlementNames: new Map([[SOFIA, 'София'], [PLOVDIV, 'Пловдив']]),
  existingAreas: new Map([[SOFIA, ['Лозенец', 'Изгрев']]]),
};

describe('buildPropertyPreview', () => {
  it('counts each outcome', () => {
    const preview = buildPropertyPreview(
      [row(1, 'valid', valid()), row(2, 'valid', valid()), row(3, 'duplicate', valid()), row(4, 'invalid'), row(5, 'skipped', valid())],
      context,
    );
    expect(preview.counts).toEqual({ new: 2, duplicate: 1, invalid: 1, skipped: 1 });
  });

  it('lists each new area once per settlement with its rows, ticked by default, with a near-duplicate warning', () => {
    const preview = buildPropertyPreview(
      [
        row(1, 'valid', valid({ new_area: vitosha })),
        row(2, 'valid', valid({ new_area: vitosha })),
        row(3, 'valid', valid({ new_area: vitosha })),
        row(4, 'valid', valid({ new_area: lozenek })),
        row(5, 'valid', valid({ new_area: trakia })),
      ],
      context,
    );
    expect(preview.newAreas).toEqual([
      { key: vitosha.key, name: 'Витоша', settlementName: 'София', rows: 3, similarTo: null, checked: true },
      { key: lozenek.key, name: 'Лозенек', settlementName: 'София', rows: 1, similarTo: 'Лозенец', checked: true },
      { key: trakia.key, name: 'Тракия', settlementName: 'Пловдив', rows: 1, similarTo: null, checked: true },
    ]);
  });

  it('keeps the saved choice of areas', () => {
    const preview = buildPropertyPreview(
      [row(1, 'valid', valid({ new_area: vitosha })), row(2, 'valid', valid({ new_area: trakia }))],
      { ...context, createAreas: [trakia.key] },
    );
    expect(preview.newAreas.map((a) => [a.name, a.checked])).toEqual([['Витоша', false], ['Тракия', true]]);
  });

  it('only counts areas, BGN prices and owners of the rows that will be written', () => {
    const rows = [
      row(1, 'valid', valid({ bgn_converted: true, new_area: vitosha })),
      row(2, 'duplicate', valid({ bgn_converted: true, new_area: trakia, owner_contact_id: 'c-1' })),
      row(3, 'skipped', valid({ bgn_converted: true, new_area: trakia })),
    ];
    const skip = buildPropertyPreview(rows, context);
    expect(skip.bgnConverted).toBe(1);
    expect(skip.newAreas.map((a) => a.name)).toEqual(['Витоша']);
    expect(skip.owners).toEqual({ matched: 0, created: 0 });

    // Under "create anyway" the commit writes duplicates too (import_commit_properties).
    const create = buildPropertyPreview(rows, { ...context, duplicateStrategy: 'create' });
    expect(create.bgnConverted).toBe(2);
    expect(create.newAreas.map((a) => a.name)).toEqual(['Витоша', 'Тракия']);
    expect(create.owners).toEqual({ matched: 1, created: 0 });
  });

  it('counts owners as the commit will: one contact per existing match, new owners shared by phone or email', () => {
    const owner = (first_name: string, phone: string | null, email: string | null) => ({ first_name, last_name: null, phone, email });
    const preview = buildPropertyPreview(
      [
        row(1, 'valid', valid({ owner_contact_id: 'c-1' })),
        row(2, 'valid', valid({ owner_contact_id: 'c-1' })),
        row(3, 'valid', valid({ new_owner: owner('А', '+359899400001', 'a@example.test') })),
        row(4, 'valid', valid({ new_owner: owner('А', null, 'a@example.test') })), //  same as row 3 by email
        row(5, 'valid', valid({ new_owner: owner('Б', '+359899400002', null) })),
        row(6, 'valid', valid({ new_owner: owner('В', null, null) })), //            name only: always new
        row(7, 'valid', valid({ new_owner: owner('В', null, null) })),
      ],
      context,
    );
    expect(preview.owners).toEqual({ matched: 1, created: 4 });
  });

  it('only shares a new owner by the phone and email of a contact the commit created', () => {
    const owner = (first_name: string, phone: string | null, email: string | null) => ({ first_name, last_name: null, phone, email });
    // Row 2 reuses row 1's contact by email; its own phone is never saved, so row 3, which
    // shares only that phone, gets a contact of its own (import_commit_properties step 3).
    const preview = buildPropertyPreview(
      [
        row(1, 'valid', valid({ new_owner: owner('А', '+359899400001', 'a@example.test') })),
        row(2, 'valid', valid({ new_owner: owner('А', '+359899400002', 'a@example.test') })),
        row(3, 'valid', valid({ new_owner: owner('Б', '+359899400002', 'b@example.test') })),
      ],
      context,
    );
    expect(preview.owners).toEqual({ matched: 0, created: 2 });
  });

  it('gives each row its outcome, a label from the file, its errors and warnings', () => {
    const warning = { field: 'owner_name', code: 'import.warnings.ownerSkippedNoName' };
    const error = { field: 'settlement', code: 'import.errors.settlementNotFound' };
    const preview = buildPropertyPreview(
      [
        row(1, 'valid', valid({ warnings: [warning] })),
        row(2, 'invalid', null, { errors: [error] }),
        row(3, 'duplicate', valid(), { match_reason: 'address' }),
      ],
      context,
    );
    expect(preview.rows).toEqual([
      { rowNumber: 1, status: 'valid', matchReason: null, label: 'гараж, София, ул. Тест 1', errors: [], warnings: [warning] },
      { rowNumber: 2, status: 'invalid', matchReason: null, label: 'гараж, София, ул. Тест 2', errors: [error], warnings: [] },
      { rowNumber: 3, status: 'duplicate', matchReason: 'address', label: 'гараж, София, ул. Тест 3', errors: [], warnings: [] },
    ]);
  });
});
