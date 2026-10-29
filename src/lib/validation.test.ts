import { describe, expect, it } from 'vitest';
import { NONE_SELECT_VALUE, nullableUuid } from './validation';

const ID = '11111111-1111-4111-8111-111111111111';

describe('nullableUuid', () => {
  const schema = nullableUuid();

  it.each([NONE_SELECT_VALUE, '', null])('parses %j to null', (value) => {
    expect(schema.parse(value)).toBeNull();
  });

  it('passes a uuid through', () => {
    expect(schema.parse(ID)).toBe(ID);
  });

  it('keeps undefined undefined', () => {
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it('rejects other strings', () => {
    expect(schema.safeParse('nobody').success).toBe(false);
  });
});
