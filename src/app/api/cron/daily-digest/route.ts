import { timingSafeEqual } from 'node:crypto';
import { createMailer } from '@/domain/notifications/mailer';
import { NotificationRepository } from '@/domain/notifications/repository';
import { NotificationService } from '@/domain/notifications/service';
import { getAppUrl } from '@/lib/app-url';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Sends the daily digest to every agency whose local time is 08:xx on a weekday (AD-042).
 *
 * The service role bypasses RLS, so the repository filters every query by `agency_id`.
 * The route stays off until `go-live` sets `CRON_SECRET`: while it is unset every call is refused.
 * Vercel Cron calls it with `GET` and `Authorization: Bearer $CRON_SECRET`. Outside production,
 * `?now=<ISO instant>` stands in for the clock so a digest can be tried on any day.
 */
export const dynamic = 'force-dynamic';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: 'cron_disabled' }, 503);

  const authorization = request.headers.get('authorization') ?? '';
  const given = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (!sameSecret(given, secret)) return json({ error: 'unauthorized' }, 401);

  const isProduction = process.env.NODE_ENV === 'production';
  const nowParam = new URL(request.url).searchParams.get('now');
  let now = new Date();
  if (nowParam && !isProduction) {
    now = new Date(nowParam);
    if (isNaN(now.getTime())) return json({ error: 'invalid_now' }, 400);
  }

  const appUrl = getAppUrl();
  if (!appUrl) return json({ error: 'app_url_not_configured' }, 500);

  try {
    const service = new NotificationService(new NotificationRepository(createSupabaseAdmin()), createMailer(), appUrl);
    const result = await service.runDueAgencies(now);
    return json({ now: now.toISOString(), ...result });
  } catch (error) {
    console.error('Daily digest run failed:', error);
    return json({ error: 'run_failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}
