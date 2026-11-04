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

const BROKER_ID = '11111111-1111-4111-8111-111111111111';

describe('task schemas: assigned_to', () => {
  it('create parses the "none" select sentinel to null', () => {
    const parsed = taskSchemas(SOFIA).create.parse({ title: 'Call back', assigned_to: 'none' });
    expect(parsed.assigned_to).toBeNull();
  });

  it('create keeps a broker uuid', () => {
    const parsed = taskSchemas(SOFIA).create.parse({ title: 'Call back', assigned_to: BROKER_ID });
    expect(parsed.assigned_to).toBe(BROKER_ID);
  });

  it('update parses "none" to null', () => {
    expect(taskSchemas(SOFIA).update.parse({ assigned_to: 'none' }).assigned_to).toBeNull();
  });
});

const OPPORTUNITY_ID = '22222222-2222-4222-8222-222222222222';
const PROPERTY_ID = '33333333-3333-4333-8333-333333333333';

describe('task schemas: property_id on viewings (spec: properties, rule 7)', () => {
  it('keeps the property of a viewing on an opportunity', () => {
    const parsed = taskSchemas(SOFIA).create.parse({
      title: 'Viewing',
      task_type: 'viewing',
      opportunity_id: OPPORTUNITY_ID,
      property_id: PROPERTY_ID,
    });
    expect(parsed.property_id).toBe(PROPERTY_ID);
  });

  it('refuses a property without an opportunity, with an i18n key', () => {
    const result = taskSchemas(SOFIA).create.safeParse({ title: 'Viewing', task_type: 'viewing', property_id: PROPERTY_ID });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.property_id).toEqual(['validation.property_needs_opportunity']);
  });

  it('drops the property of any other task type, and treats "" as none', () => {
    const schemas = taskSchemas(SOFIA);
    expect(
      schemas.create.parse({ title: 'Call', task_type: 'call', opportunity_id: OPPORTUNITY_ID, property_id: PROPERTY_ID }).property_id,
    ).toBeNull();
    expect(schemas.create.parse({ title: 'Viewing', task_type: 'viewing', property_id: '' }).property_id).toBeNull();
  });

  it('carries the property through the next task of a completion', () => {
    const parsed = taskSchemas(SOFIA).completeWithNext.parse({
      outcome: 'Called',
      next_task: { title: 'Viewing', task_type: 'viewing', opportunity_id: OPPORTUNITY_ID, property_id: PROPERTY_ID },
    });
    expect(parsed.next_task?.property_id).toBe(PROPERTY_ID);
  });
});
