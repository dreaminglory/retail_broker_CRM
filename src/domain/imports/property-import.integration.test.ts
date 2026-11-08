import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { areaKey, type NormalizedPropertyRow } from './property-validation';
import { ImportService } from './service';
import type { ImportRow } from './types';

const HEADERS = ['Тип', 'Град', 'Община', 'Квартал', 'Адрес', 'Площ', 'Етаж', 'Цена', 'Наем', 'Статус', 'Брокер', 'Реф'];
const MAPPING = {
  type: 'Тип', settlement: 'Град', municipality: 'Община', area: 'Квартал', address: 'Адрес', area_m2: 'Площ',
  floor: 'Етаж', sale_price: 'Цена', rent_price: 'Наем', listing_status: 'Статус', assigned_to: 'Брокер',
  external_ref: 'Реф',
};

describeServices('Property import against the local stack', () => {
  const cleanup = createRowCleanup();
  let owner: TestSession;
  let broker: TestSession;
  let sofiaId: string;
  let plovdivId: string;
  let lozenSofiaId: string;
  let lozenHaskovoId: string;
  let lozenetsId: string;

  beforeAll(async () => {
    owner = await signInAs('owner@alpha.bg');
    broker = await signInAs('broker@alpha.bg');

    const { data: settlements } = await owner.db.from('settlements').select('id, ekatte').in('ekatte', ['68134', '56784', '44063', '44077']);
    const byCode = new Map(settlements!.map((s) => [s.ekatte, s.id as string]));
    sofiaId = byCode.get('68134')!;
    plovdivId = byCode.get('56784')!;
    lozenSofiaId = byCode.get('44063')!;
    lozenHaskovoId = byCode.get('44077')!;

    const { data: area } = await owner.db.from('areas').select('id').eq('agency_id', owner.agencyId).eq('settlement_id', sofiaId).eq('name', 'Лозенец').single();
    lozenetsId = area!.id;
  });

  afterAll(() => cleanup.run());

  async function stage(rows: Record<string, string>[], session: TestSession = owner, options: Record<string, unknown> = {}) {
    const service = new ImportService(session.db);
    const { jobId } = await service.createJob(session.agencyId, {
      file_name: 'properties-basic.csv',
      file_sha256: 'b'.repeat(64),
      file_size_bytes: 1000,
      encoding: 'utf-8',
      delimiter: ',',
      entity_type: 'property',
      headers: HEADERS,
    });
    cleanup.track('import_jobs', jobId);
    await service.saveMapping(session.agencyId, jobId, MAPPING, { duplicate_strategy: 'skip', ...options });
    await service.stageRows(session.agencyId, jobId, { startRow: 1, rows });
    return { jobId, service };
  }

  async function rowsOf(jobId: string): Promise<ImportRow[]> {
    const { data } = await owner.db.from('import_rows').select('*').eq('import_job_id', jobId).order('row_number');
    return data as ImportRow[];
  }

  const row = (cells: Partial<Record<(typeof HEADERS)[number], string>>) =>
    Object.fromEntries(HEADERS.map((h) => [h, cells[h] ?? '']));

  describe('validation (Task 3)', () => {
    it('validates a 20-row file with settlements, areas, listings and assignees resolved', async () => {
      const { data: profile } = await owner.db.from('profiles').select('email').eq('id', broker.userId).single();
      const rows = [
        row({ Тип: 'двустаен', Град: 'София', Квартал: 'Лозенец', Площ: '68', Цена: '185 000', Брокер: profile!.email }),
        row({ Тип: 'тристаен', Град: 'гр. София', Квартал: 'Витоша', Площ: '92,5', Цена: '€240,000' }),
        row({ Тип: 'студио', Град: 'Sofia', Квартал: 'витоша', Площ: '35', Наем: '600' }),
        row({ Тип: 'гараж', Град: 'София', Квартал: 'ВИТОША ', Площ: '18', Наем: '1 200 лв.' }),
        row({ Тип: 'къща', Град: 'с. Лозен', Община: 'Столична', Площ: '160', Цена: '320000', Статус: 'резервирана' }),
        row({ Тип: 'гараж', Град: '44077', Площ: '20', Цена: '25000' }),
        row({ Тип: 'мезонет', Град: 'Пловдив', Квартал: 'Кършияка', Площ: '140', Етаж: '5' }),
        ...Array.from({ length: 13 }, (_, i) => row({ Тип: 'гараж', Град: 'Пловдив', Площ: String(15 + i), Наем: String(100 + i) })),
      ];
      expect(rows).toHaveLength(20);
      const { jobId, service } = await stage(rows);

      const summary = await service.validate(owner.agencyId, jobId, owner.userId);

      expect(summary).toMatchObject({ total: 20, valid: 20, invalid: 0 });
      const result = await rowsOf(jobId);
      expect(result.every((r) => r.status === 'valid')).toBe(true);
      const n = result.map((r) => r.normalized as unknown as NormalizedPropertyRow);

      expect(n[0].property).toMatchObject({ type: 'apartment', rooms: 2, settlement_id: sofiaId, area_id: lozenetsId, assigned_to: broker.userId });
      expect(n[0].listings).toEqual([expect.objectContaining({ offer_type: 'sale', price: 185000, status: 'active' })]);
      expect(n[1].property.assigned_to).toBe(owner.userId);

      // Three spellings of an unknown "Витоша" share one new area.
      const vitosha = { settlement_id: sofiaId, name: 'Витоша', key: areaKey(sofiaId, 'Витоша') };
      expect(n[1].new_area).toEqual(vitosha);
      expect(n[2].new_area?.key).toBe(vitosha.key);
      expect(n[3].new_area?.key).toBe(vitosha.key);

      expect(n[3]).toMatchObject({ listings: [{ offer_type: 'rent', price: 613.55 }], bgn_converted: true });
      expect(n[4]).toMatchObject({ property: { settlement_id: lozenSofiaId }, listings: [{ status: 'reserved' }] });
      expect(n[5].property.settlement_id).toBe(lozenHaskovoId);
      expect(n[6].property).toMatchObject({ settlement_id: plovdivId, area_id: expect.any(String) });
      expect(n[6].new_area).toBeNull();
    });

    it('marks ambiguous and unknown settlements invalid with the reasons', async () => {
      const { jobId, service } = await stage([
        row({ Тип: 'гараж', Град: 'Лозен' }),
        row({ Тип: 'гараж', Град: 'Атлантида' }),
      ]);

      const summary = await service.validate(owner.agencyId, jobId, owner.userId);

      expect(summary).toMatchObject({ valid: 0, invalid: 2 });
      const [ambiguous, unknown] = await rowsOf(jobId);
      expect(ambiguous.errors).toEqual([expect.objectContaining({ code: 'import.errors.settlementAmbiguous', detail: expect.stringContaining('Столична') })]);
      expect(unknown.errors).toEqual([{ field: 'settlement', code: 'import.errors.settlementNotFound' }]);
    });

    it("never matches another agency's areas or members", async () => {
      const beta = await signInAs('owner@beta.bg');
      const { data: betaArea, error } = await beta.db
        .from('areas')
        .insert({ agency_id: beta.agencyId, settlement_id: sofiaId, name: 'Бета Парк' })
        .select('id')
        .single();
      expect(error).toBeNull();
      cleanup.track('areas', betaArea!.id);

      const { jobId, service } = await stage([
        row({ Тип: 'гараж', Град: 'София', Квартал: 'Бета Парк' }),
        row({ Тип: 'гараж', Град: 'София', Брокер: 'broker@beta.bg' }),
      ]);

      await service.validate(owner.agencyId, jobId, owner.userId);

      const [area, member] = await rowsOf(jobId);
      expect(area.status).toBe('valid');
      expect((area.normalized as unknown as NormalizedPropertyRow).property.area_id).toBeNull();
      expect((area.normalized as unknown as NormalizedPropertyRow).new_area).toMatchObject({ settlement_id: sofiaId, name: 'Бета Парк' });
      expect(member.status).toBe('invalid');
      expect(member.errors).toEqual([{ field: 'assigned_to', code: 'import.errors.unknownAssignee' }]);
    });
  });
});
