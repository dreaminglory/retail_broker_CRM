import type { SupabaseClient } from '@supabase/supabase-js';
import { agencySettingsSchema } from '@/domain/agencies/settings';
import type { MemberRole } from '@/domain/members/types';
import { DomainError } from '@/lib/errors';
import type {
  DeliveryStatus,
  DigestInquiryInput,
  DigestRecipient,
  DigestTaskInput,
  NotificationKind,
  NotificationLocale,
} from './types';

/** PostgREST returns at most 1,000 rows a request, so larger sets are read page by page. */
const PAGE_SIZE = 1000;

type Page<Row> = PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;

async function fetchAll<Row>(label: string, page: (from: number, to: number) => Page<Row>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new DomainError('errors.loadFailed', `Failed to load ${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export type AgencyToNotify = { id: string; timezone: string };

export type Claim = { kind: NotificationKind; periodKey: string; entityId?: string | null };

export type Settlement = { status: Exclude<DeliveryStatus, 'pending'>; providerId?: string | null; error?: string | null };

/**
 * Database access for notifications (AD-042). It takes the service-role client, which bypasses
 * RLS, so every query filters by `agency_id` itself.
 */
export class NotificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listAgencies(): Promise<AgencyToNotify[]> {
    const rows = await fetchAll<{ id: string; settings: unknown }>('agencies', (from, to) =>
      this.db.from('agencies').select('id, settings').order('id').range(from, to),
    );
    return rows.map((row) => ({ id: row.id, timezone: parseTimezone(row.settings) }));
  }

  /** Reads the agency's timezone without a user session, which `getAgencySettings` needs. */
  async getTimezone(agencyId: string): Promise<string> {
    const { data, error } = await this.db.from('agencies').select('settings').eq('id', agencyId).single();
    if (error) throw new DomainError('errors.loadFailed', `Failed to load agency ${agencyId}: ${error.message}`);
    return parseTimezone(data.settings);
  }

  /** Active members whose daily digest is on. */
  async getDigestRecipients(agencyId: string): Promise<DigestRecipient[]> {
    const { data: memberships, error } = await this.db
      .from('agency_memberships')
      .select('user_id, role')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .not('user_id', 'is', null);
    if (error) throw new DomainError('errors.loadFailed', `Failed to load members: ${error.message}`);
    if (!memberships || memberships.length === 0) return [];

    const roles = new Map<string, MemberRole>(memberships.map((m) => [m.user_id as string, m.role as MemberRole]));
    const { data: profiles, error: profileError } = await this.db
      .from('profiles')
      .select('id, email, display_name, locale, digest_enabled')
      .in('id', [...roles.keys()])
      .eq('digest_enabled', true);
    if (profileError) throw new DomainError('errors.loadFailed', `Failed to load profiles: ${profileError.message}`);

    return (profiles ?? [])
      .filter((profile) => profile.email)
      .map((profile) => ({
        userId: profile.id as string,
        email: profile.email as string,
        name: (profile.display_name as string | null)?.trim() || (profile.email as string).split('@')[0],
        locale: (profile.locale === 'en' ? 'en' : 'bg') as NotificationLocale,
        role: roles.get(profile.id as string)!,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  /** Every assigned pending task due before `dueBefore` (agency midnight), overdue ones included. */
  async getTasksDueBefore(agencyId: string, dueBefore: string): Promise<DigestTaskInput[]> {
    const rows = await fetchAll<{ id: string; title: string; due_at: string; assigned_to: string }>('tasks', (from, to) =>
      this.db
        .from('tasks')
        .select('id, title, due_at, assigned_to')
        .eq('agency_id', agencyId)
        .eq('status', 'pending')
        .not('assigned_to', 'is', null)
        .not('due_at', 'is', null)
        .lt('due_at', dueBefore)
        .order('due_at')
        .order('id')
        .range(from, to),
    );
    return rows.map((row) => ({ id: row.id, title: row.title, dueAt: row.due_at, assignedTo: row.assigned_to }));
  }

  /** Every `new` inquiry. The unassigned ones feed the owner and manager counts. */
  async getNewInquiries(agencyId: string): Promise<DigestInquiryInput[]> {
    const rows = await fetchAll<{ id: string; caller_name: string | null; received_at: string; assigned_to: string | null }>(
      'inquiries',
      (from, to) =>
        this.db
          .from('inquiries')
          .select('id, caller_name, received_at, assigned_to')
          .eq('agency_id', agencyId)
          .eq('status', 'new')
          .order('received_at')
          .order('id')
          .range(from, to),
    );
    return rows.map((row) => ({
      id: row.id,
      callerName: row.caller_name,
      receivedAt: row.received_at,
      assignedTo: row.assigned_to,
    }));
  }

  /**
   * Takes the right to send this email (AD-051). Returns the delivery id when this caller won,
   * or null when a `sent` or `pending` row already holds the key. A `failed` or `skipped` row
   * is taken over in one conditional update, so two runs can't both win it.
   */
  async claim(agencyId: string, userId: string, { kind, periodKey, entityId }: Claim): Promise<string | null> {
    const { data: inserted, error } = await this.db
      .from('notification_deliveries')
      .upsert(
        { agency_id: agencyId, user_id: userId, kind, period_key: periodKey, entity_id: entityId ?? null, status: 'pending' },
        { onConflict: 'user_id,kind,period_key', ignoreDuplicates: true },
      )
      .select('id');
    if (error) throw new DomainError('errors.saveFailed', `Failed to claim delivery: ${error.message}`);
    if (inserted && inserted.length > 0) return inserted[0].id as string;

    const { data: retaken, error: retakeError } = await this.db
      .from('notification_deliveries')
      .update({ status: 'pending', error: null, provider_id: null })
      .eq('agency_id', agencyId)
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('period_key', periodKey)
      .in('status', ['failed', 'skipped'])
      .select('id');
    if (retakeError) throw new DomainError('errors.saveFailed', `Failed to retake delivery: ${retakeError.message}`);
    return retaken && retaken.length > 0 ? (retaken[0].id as string) : null;
  }

  async settle(agencyId: string, deliveryId: string, { status, providerId, error }: Settlement): Promise<void> {
    const { error: updateError } = await this.db
      .from('notification_deliveries')
      .update({ status, provider_id: providerId ?? null, error: error ?? null })
      .eq('agency_id', agencyId)
      .eq('id', deliveryId);
    if (updateError) throw new DomainError('errors.saveFailed', `Failed to record delivery: ${updateError.message}`);
  }
}

function parseTimezone(settings: unknown): string {
  const parsed = agencySettingsSchema.safeParse(settings);
  return (parsed.success ? parsed.data : agencySettingsSchema.parse({})).timezone;
}
