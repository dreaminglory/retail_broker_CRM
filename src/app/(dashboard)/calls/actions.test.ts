import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;
const revalidated: string[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace?: string) =>
    Object.assign(
      (key: string, values?: Record<string, string>) =>
        `${namespace ? `${namespace}.` : ''}${key}${values?.name ? `(${values.name})` : ''}`,
      { has: () => true },
    ),
}));
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidated.push(path) }));

const { logCallAction } = await import('./actions');

const INQUIRY_ID = '11111111-1111-4111-8111-111111111111';

function signIn(opts: { signedOut?: boolean } = {}) {
  revalidated.length = 0;
  fake = createFakeSupabase({
    role: 'broker',
    signedOut: opts.signedOut,
    tables: {
      agencies: { settings: { timezone: 'Europe/Sofia' } },
      inquiries: { id: INQUIRY_ID, agency_id: 'agency-1', status: 'new', opportunity_id: null, contact_id: null },
      tasks: [
        { id: 'call-1', status: 'completed', inquiry_id: INQUIRY_ID },
        { id: 'retry-1', status: 'pending', inquiry_id: INQUIRY_ID },
      ],
    },
  });
}

const noAnswer = {
  context: { inquiry_id: INQUIRY_ID },
  name: 'Ivan',
  channel: 'phone',
  result: 'no_answer',
  outcome: 'No answer',
  next: { preset: 'tomorrow_9' },
} as const;

describe('logCallAction (spec phone-loop rule 6)', () => {
  beforeEach(() => signIn());

  it('inserts the call and the retry with titles in the actor language, and revalidates', async () => {
    const result = await logCallAction(noAnswer);

    expect(result).toEqual({ success: true, data: { callTaskId: 'call-1', nextTaskId: 'retry-1' } });
    const insert = fake.writes.find((w) => w.table === 'tasks' && w.op === 'insert');
    expect(insert?.values).toEqual([
      expect.objectContaining({ title: 'phoneLoop.titles.call(Ivan)', status: 'completed', channel: 'phone', inquiry_id: INQUIRY_ID, assigned_to: 'user-1' }),
      expect.objectContaining({ title: 'phoneLoop.titles.retry(Ivan)', status: 'pending', task_type: 'call', assigned_to: 'user-1' }),
    ]);
    expect(revalidated).toEqual(expect.arrayContaining(['/today', '/inquiries', '/exceptions', '/lists']));
  });

  it('filters the inquiry by the agency', async () => {
    await logCallAction(noAnswer);
    expect(fake.filters).toContainEqual({ table: 'inquiries', column: 'agency_id', value: 'agency-1' });
  });

  it('refuses invalid input before touching the database', async () => {
    const result = await logCallAction({ ...noAnswer, outcome: '' });

    expect(result.success).toBe(false);
    expect(fake.writes).toEqual([]);
    expect(fake.touchedTables.filter((t) => t !== 'agencies')).toEqual([]);
  });

  it('refuses a signed-out caller', async () => {
    signIn({ signedOut: true });
    const result = await logCallAction(noAnswer);

    expect(result).toEqual({ success: false, error: 'errors.unauthorized' });
    expect(fake.writes).toEqual([]);
  });
});
