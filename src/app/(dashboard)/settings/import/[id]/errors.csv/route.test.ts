import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

const MESSAGES: Record<string, string> = {
  'SettingsImport.errorReportReason': 'Причина за грешката',
  'import.errors.missingName': 'Този ред няма име.',
  'errors.unexpected': 'Нещо се обърка',
};

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () =>
    Object.assign((key: string) => MESSAGES[key] ?? key, { has: (key: string) => key in MESSAGES }),
}));

const { GET } = await import('./route');

const JOB_ID = '11111111-1111-4111-8111-111111111111';

function withJob(role: string) {
  fake = createFakeSupabase({
    role,
    tables: {
      import_jobs: { id: JOB_ID, headers: ['Name'], delimiter: ',' },
      import_rows: [
        { status: 'invalid', raw: { Name: 'x' }, errors: [{ code: 'import.errors.missingName' }] },
        { status: 'error', raw: { Name: 'y' }, errors: [{ code: 'import.errors.notInMessages' }] },
        { status: 'created', raw: { Name: 'z' }, errors: [] },
      ],
    },
  });
}

const request = (id = JOB_ID) => GET({} as never, { params: Promise.resolve({ id }) });

describe('import error report', () => {
  it('reads the job only with the caller agency', async () => {
    withJob('owner');

    const response = await request();

    expect(response.status).toBe(200);
    const agencyFilters = fake.filters.filter((f) => f.table === 'import_jobs' && f.column === 'agency_id');
    expect(agencyFilters.map((f) => f.value)).toEqual(['agency-1']);
  });

  it('translates the reasons and the column header, never showing a raw key', async () => {
    withJob('manager');

    const csv = await (await request()).text();

    expect(csv).toContain('"Причина за грешката"');
    expect(csv).toContain('"Този ред няма име."');
    expect(csv).toContain('"Нещо се обърка"');
    expect(csv).not.toContain('import.errors.');
    expect(csv).not.toContain('"z"');
  });

  it('refuses a broker before reading the job', async () => {
    withJob('broker');

    const response = await request();

    expect(response.status).toBe(403);
    expect(fake.touchedTables).not.toContain('import_jobs');
  });
});
