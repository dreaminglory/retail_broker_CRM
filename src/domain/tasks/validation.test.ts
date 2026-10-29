import { describe, expect, it } from 'vitest';
import { createTaskSchema, updateTaskSchema } from './validation';

const BROKER_ID = '11111111-1111-4111-8111-111111111111';

describe('task schemas: assigned_to', () => {
  it('createTaskSchema parses the "none" select sentinel to null', () => {
    const parsed = createTaskSchema.parse({ title: 'Call back', assigned_to: 'none' });
    expect(parsed.assigned_to).toBeNull();
  });

  it('createTaskSchema keeps a broker uuid', () => {
    const parsed = createTaskSchema.parse({ title: 'Call back', assigned_to: BROKER_ID });
    expect(parsed.assigned_to).toBe(BROKER_ID);
  });

  it('updateTaskSchema parses "none" to null', () => {
    expect(updateTaskSchema.parse({ assigned_to: 'none' }).assigned_to).toBeNull();
  });
});
