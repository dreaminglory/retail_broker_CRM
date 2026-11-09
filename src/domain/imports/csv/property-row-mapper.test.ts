import { describe, expect, it } from 'vitest';
import { propertyFormSchema } from '@/domain/properties/validation';
import { propertyImportOptionsSchema, propertyMappingSchema } from '../validation';
import { mapRowToPropertyCandidate, parsePropertyAttributes } from './row-mapper';

const SOFIA = '11111111-1111-4111-8111-111111111111';
const ids = { settlement_id: SOFIA, area_id: null, assigned_to: null };

const mapping = {
  type: 'Тип', settlement: 'Град', area: 'Квартал', address: 'Адрес', rooms: 'Стаи',
  area_m2: 'Площ', plot_m2: 'Парцел', floor: 'Етаж', floors_total: 'Етажност',
  construction: 'Строителство', year_built: 'Година', sale_price: 'Цена', rent_price: 'Наем',
  listing_status: 'Статус', owner_name: 'Собственик', owner_phone: 'Телефон',
};

const row = (cells: Record<string, string>) => mapRowToPropertyCandidate(cells, mapping);

describe('mapRowToPropertyCandidate', () => {
  it('reads every mapped column through its resolver', () => {
    const candidate = row({
      Тип: 'двустаен', Град: 'гр. София', Квартал: '  Лозенец ', Адрес: 'ул. Яворов 12',
      Площ: '68,5 кв.м', Етаж: 'партер', Етажност: '6', Строителство: 'тухла', Година: '1975',
      Цена: '€185,000', Наем: '1 200 лв.', Статус: 'резервирана', Собственик: 'Иван Петров',
      Телефон: '0888 123 456',
    });
    expect(candidate).toMatchObject({
      type: 'apartment', rooms: 2, area_m2: 68.5, floor: 0, floors_total: 6, construction: 'brick',
      year_built: 1975, settlement: 'гр. София', area: 'Лозенец', address: 'ул. Яворов 12',
      sale_price: { ok: true, amount: 185000, converted: false },
      rent_price: { ok: true, amount: 613.55, converted: true },
      listing_status: 'reserved', owner_name: 'Иван Петров', owner_phone: '0888 123 456',
      plot_m2: null, external_ref: null,
    });
  });

  it('lets a rooms column win over the rooms in the type word', () => {
    expect(row({ Тип: 'двустаен', Стаи: '3' }).rooms).toBe(3);
  });
});

describe('parsePropertyAttributes reuses the property form schema', () => {
  it('accepts a valid apartment', () => {
    const result = parsePropertyAttributes(row({ Тип: 'тристаен', Площ: '90' }), ids);
    expect(result.success).toBe(true);
  });

  it.each([
    ['an apartment with no rooms', { Тип: 'апартамент' }, 'rooms'],
    ['a plot without plot area', { Тип: 'парцел' }, 'plot_m2'],
    ['a floor above the building', { Тип: 'студио', Етаж: '7', Етажност: '5' }, 'floor'],
    ['an unknown type', { Тип: 'замък' }, 'type'],
    ['an area that is not a number', { Тип: 'гараж', Площ: 'голяма' }, 'area_m2'],
  ])('rejects %s exactly as the form does', (_label, cells, field) => {
    const candidate = row(cells as Record<string, string>);
    const result = parsePropertyAttributes(candidate, ids);
    expect(result.success).toBe(false);

    const form = propertyFormSchema.safeParse({
      type: candidate.type ?? candidate.type_value ?? undefined,
      rooms: candidate.rooms, area_m2: candidate.area_m2, plot_m2: candidate.plot_m2,
      floor: candidate.floor, floors_total: candidate.floors_total, settlement_id: SOFIA,
    });
    expect(form.success).toBe(false);
    const formCode = form.success ? null : form.error.issues.find((i) => i.path[0] === field)?.message;
    if (!result.success) {
      expect(result.errors).toContainEqual({ field, code: formCode });
    }
  });

  it('reports a missing settlement with the form code', () => {
    const result = parsePropertyAttributes(row({ Тип: 'гараж' }), { ...ids, settlement_id: null });
    expect(result).toEqual({ success: false, errors: [{ field: 'settlement_id', code: 'validation.settlement_required' }] });
  });

  it('clears the fields a plot does not have, as the form does', () => {
    const result = parsePropertyAttributes(row({ Тип: 'парцел', Парцел: '600', Етаж: '2' }), ids);
    expect(result.success && result.data.floor).toBe(null);
  });
});

describe('property schemas', () => {
  it('requires the type and the settlement columns', () => {
    expect(propertyMappingSchema.safeParse({ type: 'Тип', settlement: 'Град' }).success).toBe(true);
    const missing = propertyMappingSchema.safeParse({ type: null, settlement: null });
    expect(missing.success ? [] : missing.error.issues.map((i) => i.message)).toEqual([
      'import.errors.missingPropertyTypeMapping',
      'import.errors.missingSettlementMapping',
    ]);
  });

  it('defaults the duplicate strategy to skip', () => {
    expect(propertyImportOptionsSchema.parse({})).toEqual({ duplicate_strategy: 'skip' });
    expect(propertyImportOptionsSchema.parse({ create_areas: ['x:Витоша'] }).create_areas).toEqual(['x:Витоша']);
  });

  it('accepts only the supported date formats', () => {
    for (const format of ['dd.MM.yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']) {
      expect(propertyImportOptionsSchema.parse({ date_format: format }).date_format).toBe(format);
    }
    expect(propertyImportOptionsSchema.safeParse({ date_format: 'yyyy' }).success).toBe(false);
  });
});
