import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { areaKey, type NormalizedPropertyRow } from './property-validation';
import { ImportService } from './service';
import type { ImportRow } from './types';

const HEADERS = ['Тип', 'Град', 'Община', 'Квартал', 'Адрес', 'Площ', 'Етаж', 'Цена', 'Наем', 'Статус', 'Брокер', 'Реф', 'Собственик', 'Телефон', 'Имейл'];
const MAPPING = {
  type: 'Тип', settlement: 'Град', municipality: 'Община', area: 'Квартал', address: 'Адрес', area_m2: 'Площ',
  floor: 'Етаж', sale_price: 'Цена', rent_price: 'Наем', listing_status: 'Статус', assigned_to: 'Брокер',
  external_ref: 'Реф', owner_name: 'Собственик', owner_phone: 'Телефон', owner_email: 'Имейл',
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

  describe('duplicates and owners (Task 4)', () => {
    it('skips every row whose external_ref an existing property has, so a re-run creates nothing', async () => {
      const refs = ['T4-REF-1', 'T4-REF-2'];
      const { data: made, error } = await owner.db
        .from('properties')
        .insert(refs.map((external_ref) => ({ agency_id: owner.agencyId, code: 0, type: 'garage', settlement_id: plovdivId, external_ref })))
        .select('id');
      expect(error).toBeNull();
      made!.forEach((p) => cleanup.track('properties', p.id));

      const { jobId, service } = await stage(refs.map((ref) => row({ Тип: 'гараж', Град: 'Пловдив', Реф: ref })));
      await service.validate(owner.agencyId, jobId, owner.userId);

      const result = await rowsOf(jobId);
      expect(result.map((r) => [r.status, r.match_reason])).toEqual([['skipped', 'external_ref'], ['skipped', 'external_ref']]);
      const { data: job } = await owner.db.from('import_jobs').select('skipped_count, valid_count').eq('id', jobId).single();
      expect(job).toEqual({ skipped_count: 2, valid_count: 0 });
    });

    it('finds address duplicates against the database and within the file, only in the same settlement', async () => {
      // Seeded Alpha property: "ул. Кричим 12, вх. А, ап. 9" in Sofia.
      const { data: seeded } = await owner.db.from('properties').select('id').eq('agency_id', owner.agencyId).eq('address', 'ул. Кричим 12, вх. А, ап. 9').single();
      const { jobId, service } = await stage([
        row({ Тип: 'гараж', Град: 'София', Адрес: 'ул Кричим 12 вх А ап 9' }),
        row({ Тип: 'гараж', Град: 'София', Адрес: 'бул. Тест 1' }),
        row({ Тип: 'гараж', Град: 'гр. София', Адрес: 'Тест 1' }),
        row({ Тип: 'гараж', Град: 'Пловдив', Адрес: 'бул. Тест 1' }),
        row({ Тип: 'гараж', Град: 'София' }),
        row({ Тип: 'гараж', Град: 'София' }),
      ]);

      const summary = await service.validate(owner.agencyId, jobId, owner.userId);

      const result = await rowsOf(jobId);
      expect(result.map((r) => [r.status, r.match_reason])).toEqual([
        ['duplicate', 'address'],
        ['valid', null],
        ['duplicate', 'in_file'],
        ['valid', null],
        ['valid', null],
        ['valid', null],
      ]);
      expect(result[0].matched_entity_id).toBe(seeded!.id);
      expect(summary).toMatchObject({ valid: 4, duplicate: 2 });
    });

    it('links an owner whose phone exists, creates a new one otherwise, and refuses a bad phone', async () => {
      // Seeded Alpha contact Ivan Ivanov, +359888111222.
      const { data: ivan } = await owner.db.from('contact_methods').select('contact_id').eq('agency_id', owner.agencyId).eq('value', '+359888111222').single();
      const { jobId, service } = await stage([
        row({ Тип: 'гараж', Град: 'София', Собственик: 'Иван', Телефон: '0888 111 222' }),
        row({ Тип: 'гараж', Град: 'София', Собственик: 'Нов Собственик', Телефон: '0899 765 432' }),
        row({ Тип: 'гараж', Град: 'София', Собственик: 'Грешен', Телефон: '12' }),
      ]);

      await service.validate(owner.agencyId, jobId, owner.userId);

      const [linked, created, bad] = await rowsOf(jobId);
      expect(linked.normalized).toMatchObject({ owner_contact_id: ivan!.contact_id, owner_display_name: 'Ivan Ivanov', new_owner: null });
      expect(created.normalized).toMatchObject({
        owner_contact_id: null,
        new_owner: { first_name: 'Нов', last_name: 'Собственик', phone: '+359899765432', email: null },
      });
      expect(bad).toMatchObject({ status: 'invalid', errors: [{ field: 'owner_phone', code: 'import.errors.ownerPhoneInvalid' }] });
    });

    it("never links another agency's contact as owner", async () => {
      // Seeded Beta contact Maria Petrova, +359888333444.
      const { jobId, service } = await stage([row({ Тип: 'гараж', Град: 'София', Собственик: 'Мария', Телефон: '0888 333 444' })]);
      await service.validate(owner.agencyId, jobId, owner.userId);
      const [result] = await rowsOf(jobId);
      expect(result.normalized).toMatchObject({ owner_contact_id: null, new_owner: { first_name: 'Мария' } });
    });
  });

  describe('commit (Task 5)', () => {
    async function commitAll(service: ImportService, jobId: string) {
      for (let i = 0; i < 50; i++) {
        const { remaining } = await service.commitBatch(owner.agencyId, jobId);
        if (remaining === 0) return;
      }
      throw new Error('commit did not finish');
    }

    async function trackCreated(jobId: string) {
      // Cleanup runs in reverse: areas and contacts are tracked first, so they go after the properties.
      const { data: areas } = await owner.db.from('areas').select('id').eq('import_job_id', jobId);
      areas!.forEach((a) => cleanup.track('areas', a.id));
      const { data: contacts } = await owner.db.from('contacts').select('id').eq('import_job_id', jobId);
      contacts!.forEach((c) => cleanup.track('contacts', c.id));
      const { data: props } = await owner.db.from('properties').select('id').eq('import_job_id', jobId);
      props!.forEach((p) => cleanup.track('properties', p.id));
      return { props: props!, contacts: contacts!, areas: areas! };
    }

    it('commits a validated file: shared new owner and area, listings, then a re-run creates nothing', async () => {
      const rows = [
        row({ Тип: 'двустаен', Град: 'София', Квартал: 'Т5 Квартал', Адрес: 'ул. Т5 1', Площ: '60', Цена: '185 000', Наем: '900', Собственик: 'Нов Т5', Телефон: '0899 555 001', Реф: 'T5-1' }),
        row({ Тип: 'гараж', Град: 'София', Квартал: 'т5 квартал', Адрес: 'ул. Т5 2', Площ: '18', Собственик: 'Нов Т5', Телефон: '0899 555 001', Реф: 'T5-2' }),
        row({ Тип: 'гараж', Град: 'Пловдив', Адрес: 'ул. Т5 3', Площ: '18', Наем: '1 200 лв.', Реф: 'T5-3' }),
      ];
      const { jobId, service } = await stage(rows);
      await service.validate(owner.agencyId, jobId, owner.userId);
      await commitAll(service, jobId);

      const { data: areas } = await owner.db.from('areas').select('id, name').eq('import_job_id', jobId);
      const created = await trackCreated(jobId);

      const { data: job } = await owner.db.from('import_jobs').select('status, created_count').eq('id', jobId).single();
      expect(job).toEqual({ status: 'completed', created_count: 3 });
      expect(areas).toEqual([expect.objectContaining({ name: 'Т5 Квартал' })]);
      expect(created.contacts).toHaveLength(1);

      const { data: parties } = await owner.db.from('property_parties').select('contact_id, role').eq('import_job_id', jobId);
      expect(parties).toEqual([
        { contact_id: created.contacts[0].id, role: 'owner' },
        { contact_id: created.contacts[0].id, role: 'owner' },
      ]);
      const { data: listings } = await owner.db.from('listings').select('offer_type, price, currency').eq('import_job_id', jobId).order('price');
      expect(listings).toEqual([
        { offer_type: 'rent', price: 613.55, currency: 'EUR' },
        { offer_type: 'rent', price: 900, currency: 'EUR' },
        { offer_type: 'sale', price: 185000, currency: 'EUR' },
      ]);

      const again = await stage(rows);
      const summary = await again.service.validate(owner.agencyId, again.jobId, owner.userId);
      expect(summary).toMatchObject({ valid: 0 });
      const result = await rowsOf(again.jobId);
      expect(result.map((r) => r.status)).toEqual(['skipped', 'skipped', 'skipped']);
    });

    it('imports the rows of an unticked new area without an area', async () => {
      const rows = [1, 2, 3].map((i) => row({ Тип: 'гараж', Град: 'София', Квартал: 'Т5 Витоша', Площ: '18', Адрес: `ул. Т5 Витоша ${i}` }));
      const { jobId, service } = await stage(rows);
      await service.validate(owner.agencyId, jobId, owner.userId);
      const { error } = await owner.db.from('import_jobs').update({ options: { duplicate_strategy: 'skip', create_areas: [] } }).eq('id', jobId);
      expect(error).toBeNull();

      await commitAll(service, jobId);
      const created = await trackCreated(jobId);

      expect(created.props).toHaveLength(3);
      expect(created.areas).toEqual([]);
      const { data: props } = await owner.db.from('properties').select('area_id').eq('import_job_id', jobId);
      expect(props!.every((p) => p.area_id === null)).toBe(true);
    });
  });

  describe('revert (Task 6)', () => {
    it('deletes the untouched property, its owner and area, and keeps the one with a note and its owner', async () => {
      const rows = [
        row({ Тип: 'гараж', Град: 'София', Квартал: 'Т6 Квартал', Адрес: 'ул. Т6 1', Площ: '18', Цена: '20000', Собственик: 'Т6 Едно', Телефон: '0899 666 001' }),
        row({ Тип: 'гараж', Град: 'София', Квартал: 'Т6 Квартал', Адрес: 'ул. Т6 2', Площ: '18', Собственик: 'Т6 Две', Телефон: '0899 666 002' }),
      ];
      const { jobId, service } = await stage(rows);
      await service.validate(owner.agencyId, jobId, owner.userId);
      await service.commitBatch(owner.agencyId, jobId);

      // Tracked first so cleanup removes what the revert keeps (it runs in reverse).
      const { data: areas } = await owner.db.from('areas').select('id').eq('import_job_id', jobId);
      areas!.forEach((a) => cleanup.track('areas', a.id));
      const { data: contacts } = await owner.db.from('contacts').select('id').eq('import_job_id', jobId);
      contacts!.forEach((c) => cleanup.track('contacts', c.id));
      const [untouched, worked] = (await rowsOf(jobId)).map((r) => r.entity_id!);
      cleanup.track('properties', untouched);
      cleanup.track('properties', worked);

      const { data: note, error } = await owner.db
        .from('notes')
        .insert({ agency_id: owner.agencyId, property_id: worked, content: 'Viewed it', created_by: owner.userId })
        .select('id')
        .single();
      expect(error).toBeNull();
      cleanup.track('notes', note!.id);

      const result = await service.revert(owner.agencyId, jobId);

      expect(result).toEqual({
        deleted: { contacts: 1, inquiries: 0, properties: 1, areas: 0 },
        kept: { contacts: 1, inquiries: 0, properties: 1, areas: 1 },
      });
      const { data: left } = await owner.db.from('properties').select('id').in('id', [untouched, worked]);
      expect(left).toEqual([{ id: worked }]);
      expect((await rowsOf(jobId)).map((r) => r.status)).toEqual(['reverted', 'revert_skipped']);
    });
  });
});
