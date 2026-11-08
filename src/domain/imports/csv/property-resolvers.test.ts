import { describe, expect, it } from 'vitest';
import {
  BGN_PER_EUR,
  normalizeAreaName,
  normalizeSettlementName,
  parseNumber,
  parsePrice,
  resolveConstruction,
  resolveFloor,
  resolveListingStatus,
  resolvePropertyType,
} from './property-resolvers';

describe('resolvePropertyType', () => {
  it.each([
    ['апартамент', { type: 'apartment', rooms: null }],
    ['Студио', { type: 'studio', rooms: null }],
    ['мезонет', { type: 'maisonette', rooms: null }],
    ['къща', { type: 'house', rooms: null }],
    ['Етаж от къща', { type: 'house_floor', rooms: null }],
    ['парцел', { type: 'plot', rooms: null }],
    ['гараж', { type: 'garage', rooms: null }],
    ['house_floor', { type: 'house_floor', rooms: null }],
    ['Apartment', { type: 'apartment', rooms: null }],
    ['едностаен', { type: 'apartment', rooms: 1 }],
    ['двустаен', { type: 'apartment', rooms: 2 }],
    [' Тристаен ', { type: 'apartment', rooms: 3 }],
    ['четиристаен', { type: 'apartment', rooms: 4 }],
    ['многостаен', { type: 'apartment', rooms: 5 }],
  ])('%s', (value, expected) => {
    expect(resolvePropertyType(value)).toEqual(expected);
  });

  it('returns null for blank or unknown text', () => {
    expect(resolvePropertyType('')).toBeNull();
    expect(resolvePropertyType(null)).toBeNull();
    expect(resolvePropertyType('замък')).toBeNull();
  });
});

describe('parseNumber', () => {
  it.each([
    ['3', 3],
    ['68,5', 68.5],
    ['68.5', 68.5],
    ['68.5 кв.м', 68.5],
    ['68,5 кв. м', 68.5],
    ['120 m2', 120],
    ['85м²', 85],
    ['1 200', 1200],
    ['1 200', 1200],
    ['185,000', 185000],
    // A dot before exactly three digits is a thousands separator, as a comma is.
    ['185.000', 185000],
    ['1.200', 1200],
    ['1.250.000', 1250000],
    ['2.5', 2.5],
    ['68.50', 68.5],
    ['1.200,50', 1200.5],
    ['1,200.50', 1200.5],
  ])('%s → %d', (value, expected) => {
    expect(parseNumber(value)).toBe(expected);
  });

  it('returns null for blank and NaN for garbage', () => {
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber('много')).toBeNaN();
    expect(parseNumber('12abc')).toBeNaN();
  });
});

describe('resolveFloor', () => {
  it.each([
    ['партер', 0],
    ['Партер', 0],
    ['сутерен', -1],
    ['3', 3],
    ['3-ти', 3],
    ['5 ет.', 5],
  ])('%s → %d', (value, expected) => {
    expect(resolveFloor(value)).toBe(expected);
  });

  it('returns null for blank and NaN for garbage', () => {
    expect(resolveFloor('')).toBeNull();
    expect(resolveFloor('последен')).toBeNaN();
  });
});

describe('resolveConstruction', () => {
  it.each([
    ['тухла', 'brick'],
    ['Тухла', 'brick'],
    ['панел', 'panel'],
    ['ЕПК', 'epk'],
    ['гредоред', 'timber'],
    ['brick', 'brick'],
    ['пълзящ кофраж', 'other'],
  ])('%s → %s', (value, expected) => {
    expect(resolveConstruction(value)).toBe(expected);
  });

  it('returns null for blank', () => {
    expect(resolveConstruction(' ')).toBeNull();
  });
});

describe('parsePrice', () => {
  it.each([
    ['185 000', { ok: true, amount: 185000, converted: false }],
    ['€185,000', { ok: true, amount: 185000, converted: false }],
    ['185000 EUR', { ok: true, amount: 185000, converted: false }],
    ['900 евро', { ok: true, amount: 900, converted: false }],
    ['1 200 лв.', { ok: true, amount: 613.55, converted: true }],
    ['1200 BGN', { ok: true, amount: 613.55, converted: true }],
    ['250000 лева', { ok: true, amount: 127822.97, converted: true }],
    ['185.000', { ok: true, amount: 185000, converted: false }],
    ['185.000 €', { ok: true, amount: 185000, converted: false }],
    ['1.200 лв.', { ok: true, amount: 613.55, converted: true }],
  ])('%s', (value, expected) => {
    expect(parsePrice(value)).toEqual(expected);
  });

  it('uses the fixed rate', () => {
    expect(BGN_PER_EUR).toBe(1.95583);
  });

  it('returns null for blank and not ok for garbage, zero or a negative amount', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('по договаряне')).toEqual({ ok: false });
    expect(parsePrice('0')).toEqual({ ok: false });
    expect(parsePrice('-100')).toEqual({ ok: false });
  });
});

describe('resolveListingStatus', () => {
  it.each([
    ['активна', 'active'],
    ['Active', 'active'],
    ['резервирана', 'reserved'],
    ['продадена', 'closed'],
    ['отдадена', 'closed'],
    ['оттеглена', 'withdrawn'],
    ['withdrawn', 'withdrawn'],
  ])('%s → %s', (value, expected) => {
    expect(resolveListingStatus(value)).toBe(expected);
  });

  it('defaults to active for blank and returns null for unknown text', () => {
    expect(resolveListingStatus('')).toBe('active');
    expect(resolveListingStatus(null)).toBe('active');
    expect(resolveListingStatus('може би')).toBeNull();
  });
});

describe('normalizeSettlementName', () => {
  it.each([
    ['София', 'софия'],
    ['гр. Пловдив', 'пловдив'],
    ['гр.Пловдив', 'пловдив'],
    ['с. Лозен', 'лозен'],
    ['град  Варна', 'варна'],
    ['село Лозен', 'лозен'],
    [' Sofia ', 'sofia'],
    ['Сливен', 'сливен'],
    ['Стара   Загора', 'стара загора'],
  ])('%s → %s', (value, expected) => {
    expect(normalizeSettlementName(value)).toBe(expected);
  });
});

describe('normalizeAreaName', () => {
  it('trims and collapses spacing, keeping the case for display', () => {
    expect(normalizeAreaName('  Лозенец   2 ')).toBe('Лозенец 2');
    expect(normalizeAreaName('')).toBeNull();
  });
});
