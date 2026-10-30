import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runDueAgencies = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdmin: () => ({}) }));
vi.mock('@/domain/notifications/mailer', () => ({ createMailer: () => ({ send: vi.fn() }) }));
vi.mock('@/domain/notifications/service', () => ({
  NotificationService: class {
    runDueAgencies = runDueAgencies;
  },
}));

import { GET } from './route';

const RESULT = { agencies: 2, due: 2, agenciesFailed: 0, sent: 3, failed: 0, skipped: 1, alreadyDone: 0 };
const URL_BASE = 'http://localhost:3000/api/cron/daily-digest';

function call(query = '', headers: Record<string, string> = { authorization: 'Bearer s3cret' }) {
  return GET(new Request(`${URL_BASE}${query}`, { headers }));
}

describe('GET /api/cron/daily-digest', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    runDueAgencies.mockReset().mockResolvedValue(RESULT);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses every call while no secret is configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await call('', { authorization: 'Bearer ' });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'cron_disabled' });
    expect(runDueAgencies).not.toHaveBeenCalled();
  });

  it('refuses a missing or wrong secret with 401', async () => {
    const attempts: Record<string, string>[] = [{}, { authorization: 'Bearer wrong' }, { authorization: 's3cret' }, { authorization: 'Bearer s3cre' }];
    for (const headers of attempts) {
      expect((await call('', headers)).status).toBe(401);
    }
    expect(runDueAgencies).not.toHaveBeenCalled();
  });

  it('runs the due agencies and returns the counts', async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(RESULT);
    expect(runDueAgencies).toHaveBeenCalledTimes(1);
  });

  it('takes the clock from ?now= outside production', async () => {
    await call('?now=2026-11-02T06:10:00Z');

    expect(runDueAgencies).toHaveBeenCalledWith(new Date('2026-11-02T06:10:00Z'));
  });

  it('rejects an unreadable ?now=', async () => {
    const response = await call('?now=yesterday');

    expect(response.status).toBe(400);
    expect(runDueAgencies).not.toHaveBeenCalled();
  });

  it('ignores ?now= in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const before = Date.now();

    await call('?now=2026-11-02T06:10:00Z');

    const used = runDueAgencies.mock.calls[0][0] as Date;
    expect(used.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('reports a failed run as 500 without sending a partial 200', async () => {
    runDueAgencies.mockRejectedValue(new Error('database is down'));

    const response = await call();

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'run_failed' });
  });

  it('needs the app URL in production, where there is no localhost to fall back to', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');

    expect((await call()).status).toBe(500);
    expect(runDueAgencies).not.toHaveBeenCalled();
  });
});
