import { describe, expect, it } from 'vitest';
import { createAreaSchema, reorderAreasSchema, updateAreaSchema } from './validation';

const SETTLEMENT_ID = '11111111-1111-4111-8111-111111111111';

describe('createAreaSchema', () => {
  it('accepts an area and trims its name', () => {
    expect(createAreaSchema.parse({ settlement_id: SETTLEMENT_ID, name: '  Лозенец ' })).toEqual({
      settlement_id: SETTLEMENT_ID,
      name: 'Лозенец',
    });
  });

  it('refuses a blank name with an i18n key', () => {
    const result = createAreaSchema.safeParse({ settlement_id: SETTLEMENT_ID, name: '   ' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('validation.name_required');
  });

  it('refuses a name over 100 characters', () => {
    expect(createAreaSchema.safeParse({ settlement_id: SETTLEMENT_ID, name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('needs a settlement', () => {
    const result = createAreaSchema.safeParse({ settlement_id: '', name: 'Лозенец' });
    expect(result.error?.issues[0].message).toBe('validation.settlement_required');
  });
});

describe('updateAreaSchema', () => {
  it('accepts a rename or an active flag alone', () => {
    expect(updateAreaSchema.parse({ name: 'Център' })).toEqual({ name: 'Център' });
    expect(updateAreaSchema.parse({ is_active: false })).toEqual({ is_active: false });
  });
});

describe('reorderAreasSchema', () => {
  it('needs ids and non-negative positions', () => {
    expect(reorderAreasSchema.safeParse([{ id: SETTLEMENT_ID, sort_order: -1 }]).success).toBe(false);
    expect(reorderAreasSchema.parse([{ id: SETTLEMENT_ID, sort_order: 2 }])).toHaveLength(1);
  });
});
