import { describe, expect, it } from 'vitest';
import { missingRequiredFields, REQUIRED_MAPPING_FIELDS } from './validation';

describe('missingRequiredFields', () => {
  it('marks the type and the settlement as required for a property file', () => {
    expect(REQUIRED_MAPPING_FIELDS.property).toEqual(['type', 'settlement']);
  });

  it('lists every required property field that has no column, in order', () => {
    expect(missingRequiredFields('property', {})).toEqual(['type', 'settlement']);
    expect(missingRequiredFields('property', { type: 'Тип имот', settlement: null })).toEqual(['settlement']);
    expect(missingRequiredFields('property', { type: 'Тип имот', settlement: 'Населено място' })).toEqual([]);
  });

  it('has no single required field for contacts and inquiries (their rules are either-or)', () => {
    expect(missingRequiredFields('contact', {})).toEqual([]);
    expect(missingRequiredFields('inquiry', {})).toEqual([]);
  });
});
