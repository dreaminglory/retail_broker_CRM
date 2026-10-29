import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { taskSchemas } from './validation';
import en from '../../../messages/en.json';
import bg from '../../../messages/bg.json';

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

describe('task validation messages', () => {
  // Every key the task schemas (and toActionError's fallback) can show is translated.
  const source = readFileSync(join(__dirname, 'validation.ts'), 'utf8');
  const keys = [...new Set([...source.matchAll(/'validation\.([a-z_]+)'/g)].map((m) => m[1])), 'failed'];

  it.each([
    ['en', en],
    ['bg', bg],
  ] as const)('%s has every task validation key', (_locale, messages) => {
    const validation = (messages as unknown as { validation?: Record<string, string> }).validation ?? {};
    expect(keys.filter((key) => !validation[key])).toEqual([]);
  });
});
