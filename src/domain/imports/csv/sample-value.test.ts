import { describe, expect, it } from 'vitest';
import { sampleValue } from './sample-value';

const headers = ['Тип имот', 'Населено място', 'Община'];
const rows = [
  ['двустаен', 'София', ''],
  ['тристаен', 'гр. София', '  Столична '],
];

describe('sampleValue', () => {
  it('takes the first non-blank value of the mapped column', () => {
    expect(sampleValue(headers, rows, 'Тип имот')).toBe('двустаен');
    expect(sampleValue(headers, rows, 'Община')).toBe('Столична');
  });

  it('returns null for an unmapped, unknown or all-blank column', () => {
    expect(sampleValue(headers, rows, null)).toBeNull();
    expect(sampleValue(headers, rows, 'Квартал')).toBeNull();
    expect(sampleValue(headers, [['x', 'y', '']], 'Община')).toBeNull();
  });

  it('tolerates short rows', () => {
    expect(sampleValue(headers, [['x']], 'Община')).toBeNull();
  });
});
