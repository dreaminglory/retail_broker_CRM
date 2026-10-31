import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let scheduled: Array<() => Promise<void>> = [];
const createMailer = vi.fn();

vi.mock('next/server', () => ({
  after: (work: () => Promise<void>) => {
    scheduled.push(work);
  },
}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdmin: () => ({}) }));
vi.mock('@/domain/notifications/mailer', () => ({ createMailer: () => createMailer() }));

const { notifyAfterResponse } = await import('./notify-after');

describe('notifyAfterResponse', () => {
  beforeEach(() => {
    scheduled = [];
    createMailer.mockReset().mockReturnValue({ send: vi.fn() });
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('holds the work until after the response', async () => {
    const work = vi.fn().mockResolvedValue(undefined);

    notifyAfterResponse(work);
    expect(work).not.toHaveBeenCalled();

    await scheduled[0]();
    expect(work).toHaveBeenCalledOnce();
  });

  it('catches and logs a failure in the work', async () => {
    notifyAfterResponse(async () => {
      throw new Error('mail down');
    });

    await expect(scheduled[0]()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('catches and logs a mail transport that is not configured', async () => {
    createMailer.mockImplementation(() => {
      throw new Error('MAIL_TRANSPORT is not set');
    });
    const work = vi.fn();

    notifyAfterResponse(work);

    await expect(scheduled[0]()).resolves.toBeUndefined();
    expect(work).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('refuses to send without an app URL in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    const work = vi.fn();

    notifyAfterResponse(work);

    await expect(scheduled[0]()).resolves.toBeUndefined();
    expect(work).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
