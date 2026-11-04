import { describe, expect, it } from 'vitest';
import { createNoteSchema, updateNoteSchema } from './validation';

const PROPERTY = '11111111-9999-0000-0000-000000000001';

describe('createNoteSchema', () => {
  it('accepts a note on a property', () => {
    const parsed = createNoteSchema.safeParse({ property_id: PROPERTY, content: 'Keys are with the neighbour' });

    expect(parsed.success && parsed.data.property_id).toBe(PROPERTY);
  });

  it.each(['', '   ', '\n\t '])('refuses a blank note (%j)', (content) => {
    const parsed = createNoteSchema.safeParse({ property_id: PROPERTY, content });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('validation.content_required');
  });

  it('trims the content it keeps', () => {
    const parsed = createNoteSchema.safeParse({ property_id: PROPERTY, content: '  Roof redone in 2024 \n' });

    expect(parsed.success && parsed.data.content).toBe('Roof redone in 2024');
  });

  it('still needs a parent', () => {
    const parsed = createNoteSchema.safeParse({ content: 'Orphan' });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('validation.linked_entity_required');
  });
});

describe('updateNoteSchema', () => {
  it('refuses blanking a note', () => {
    expect(updateNoteSchema.safeParse({ content: '  ' }).success).toBe(false);
  });
});
