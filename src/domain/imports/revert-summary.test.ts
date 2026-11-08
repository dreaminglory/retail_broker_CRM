import { describe, expect, it } from 'vitest';
import { revertSummary } from './revert-summary';

describe('revertSummary', () => {
  it('names properties, contacts and areas for a property job', () => {
    const summary = revertSummary('property', {
      deleted: { contacts: 4, inquiries: 0, properties: 18, areas: 1 },
      kept: { contacts: 1, inquiries: 0, properties: 2, areas: 0 },
    });
    expect(summary).toEqual({
      key: 'revertSuccessProperty',
      values: { properties: 18, contacts: 4, areas: 1, keptProperties: 2, keptContacts: 1, keptAreas: 0 },
    });
  });

  it('treats missing property counts as zero', () => {
    expect(revertSummary('property', { deleted: { contacts: 0, inquiries: 0 }, kept: { contacts: 0, inquiries: 0 } }).values)
      .toEqual({ properties: 0, contacts: 0, areas: 0, keptProperties: 0, keptContacts: 0, keptAreas: 0 });
  });

  it('keeps the contact and inquiry toast as it was', () => {
    const result = { deleted: { contacts: 3, inquiries: 5 }, kept: { contacts: 1, inquiries: 2 } };
    expect(revertSummary('contact', result)).toEqual({ key: 'revertSuccess', values: { deleted: 8, kept: 3 } });
    expect(revertSummary('inquiry', result)).toEqual({ key: 'revertSuccess', values: { deleted: 8, kept: 3 } });
  });
});
