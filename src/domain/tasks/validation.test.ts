import { describe, expect, it } from 'vitest';
import { taskSchemas } from './validation';

const SOFIA = 'Europe/Sofia';

describe('task schemas parse due dates in agency time', () => {
  it('stores a 14:00 Sofia due date as 12:00Z in winter (AC-6.2-1)', () => {
    const parsed = taskSchemas(SOFIA).create.parse({ title: 'Call back', due_at: '2026-01-15T14:00' });
    expect(parsed.due_at).toBe('2026-01-15T12:00:00.000Z');
  });

  it('reads edit and next-task due dates the same way', () => {
    const schemas = taskSchemas(SOFIA);
    expect(schemas.update.parse({ due_at: '2026-07-15T09:00' }).due_at).toBe('2026-07-15T06:00:00.000Z');
    const completed = schemas.completeWithNext.parse({
      outcome: 'Spoke',
      next_task: { title: 'Viewing', due_at: '2026-01-15T14:00' },
    });
    expect(completed.next_task?.due_at).toBe('2026-01-15T12:00:00.000Z');
  });

  it('clears the due date on an empty value and rejects text', () => {
    const schemas = taskSchemas(SOFIA);
    expect(schemas.update.parse({ due_at: '' }).due_at).toBeNull();
    const result = schemas.create.safeParse({ title: 'x', due_at: 'soon' });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.due_at).toEqual(['validation.invalid_date']);
  });
});
