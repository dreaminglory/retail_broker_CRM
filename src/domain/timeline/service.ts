import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TimelineEntry,
  TimelineNote,
  TimelineTask,
  TimelineAudit,
  TimelineInquiry,
  AuthorInfo,
} from './types';
import { ProfileRepository } from '@/domain/profiles/repository';
import type { Profile } from '@/domain/profiles/types';

/**
 * Builds a fallback AuthorInfo when a user UUID is present but the
 * profile row cannot be found (e.g., deleted user).
 */
function fallbackAuthor(userId: string): AuthorInfo {
  return { id: userId, email: '', display_name: userId.substring(0, 8) };
}

/**
 * Resolves a profile to an AuthorInfo object.
 * Falls back to email prefix if display_name is empty.
 */
function profileToAuthor(profile: Profile): AuthorInfo {
  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name || profile.email.split('@')[0],
  };
}

export class TimelineService {
  private readonly profileRepo: ProfileRepository;

  constructor(private readonly db: SupabaseClient) {
    this.profileRepo = new ProfileRepository(db);
  }

  async getContactTimeline(
    contactId: string,
    agencyId: string,
    limit = 20,
    offset = 0
  ): Promise<TimelineEntry[]> {
    // 1. Find linked opportunities
    const { data: opps } = await this.db
      .from('opportunities')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('primary_contact_id', contactId);

    const { data: participants } = await this.db
      .from('opportunity_participants')
      .select('opportunity_id')
      .eq('contact_id', contactId);

    const oppIds = new Set<string>();
    opps?.forEach((o) => oppIds.add(o.id));
    participants?.forEach((p) => oppIds.add(p.opportunity_id));
    const oppIdsArray = Array.from(oppIds);

    // 2. Fetch Notes
    let notesQuery = this.db
      .from('notes')
      .select('*')
      .eq('agency_id', agencyId);

    if (oppIdsArray.length > 0) {
      notesQuery = notesQuery.or(
        `contact_id.eq.${contactId},opportunity_id.in.(${oppIdsArray.join(',')})`
      );
    } else {
      notesQuery = notesQuery.eq('contact_id', contactId);
    }

    const { data: notesData, error: notesError } = await notesQuery
      .order('created_at', { ascending: false })
      .range(0, offset + limit - 1);

    if (notesError) throw new Error(`Timeline notes fetch failed: ${notesError.message}`);

    // 3. Fetch Tasks
    let tasksQuery = this.db
      .from('tasks')
      .select('*')
      .eq('agency_id', agencyId);

    if (oppIdsArray.length > 0) {
      tasksQuery = tasksQuery.or(
        `contact_id.eq.${contactId},opportunity_id.in.(${oppIdsArray.join(',')})`
      );
    } else {
      tasksQuery = tasksQuery.eq('contact_id', contactId);
    }

    const { data: tasksData, error: tasksError } = await tasksQuery
      .order('created_at', { ascending: false })
      .range(0, offset + limit - 1);

    if (tasksError) throw new Error(`Timeline tasks fetch failed: ${tasksError.message}`);

    // 4. Fetch Audit Log
    let auditQuery = this.db
      .from('audit_log')
      .select('*')
      .eq('agency_id', agencyId);

    if (oppIdsArray.length > 0) {
      auditQuery = auditQuery.or(
        `and(entity_type.eq.contact,entity_id.eq.${contactId}),and(entity_type.eq.opportunity,entity_id.in.(${oppIdsArray.join(',')}))`
      );
    } else {
      auditQuery = auditQuery.eq('entity_type', 'contact').eq('entity_id', contactId);
    }

    const { data: auditData, error: auditError } = await auditQuery
      .order('performed_at', { ascending: false })
      .range(0, offset + limit - 1);

    if (auditError) throw new Error(`Timeline audit fetch failed: ${auditError.message}`);

    // 5. Fetch Inquiries
    const { data: inquiriesData, error: inquiriesError } = await this.db
      .from('inquiries')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('contact_id', contactId)
      .order('received_at', { ascending: false })
      .range(0, offset + limit - 1);

    if (inquiriesError) throw new Error(`Timeline inquiries fetch failed: ${inquiriesError.message}`);

    // 6. Batch-resolve all author UUIDs from profiles in a single query
    const profilesMap = await this.resolveAuthors(
      notesData ?? [],
      tasksData ?? [],
      auditData ?? []
    );

    return this.mergeAndSort(
      this.enrichNotes(notesData ?? [], profilesMap),
      this.enrichTasks(tasksData ?? [], profilesMap),
      this.enrichAudits(auditData ?? [], profilesMap),
      inquiriesData as TimelineInquiry[],
      limit,
      offset
    );
  }

  async getOpportunityTimeline(
    opportunityId: string,
    agencyId: string,
    limit = 20,
    offset = 0
  ): Promise<TimelineEntry[]> {
    const { data: notesData, error: notesError } = await this.db
      .from('notes')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .range(0, offset + limit - 1);

    if (notesError) throw new Error(`Timeline notes fetch failed: ${notesError.message}`);

    const { data: tasksData, error: tasksError } = await this.db
      .from('tasks')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .range(0, offset + limit - 1);

    if (tasksError) throw new Error(`Timeline tasks fetch failed: ${tasksError.message}`);

    const { data: auditData, error: auditError } = await this.db
      .from('audit_log')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('entity_type', 'opportunity')
      .eq('entity_id', opportunityId)
      .order('performed_at', { ascending: false })
      .range(0, offset + limit - 1);

    if (auditError) throw new Error(`Timeline audit fetch failed: ${auditError.message}`);

    // Batch-resolve all author UUIDs
    const profilesMap = await this.resolveAuthors(
      notesData ?? [],
      tasksData ?? [],
      auditData ?? []
    );

    return this.mergeAndSort(
      this.enrichNotes(notesData ?? [], profilesMap),
      this.enrichTasks(tasksData ?? [], profilesMap),
      this.enrichAudits(auditData ?? [], profilesMap),
      [],
      limit,
      offset
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Collects all unique non-null user UUIDs from all raw timeline rows,
   * then fetches the profiles in a single batched DB call.
   * Returns a Map<userId, Profile> for O(1) lookup.
   */
  private async resolveAuthors(
    notes: Array<Record<string, unknown>>,
    tasks: Array<Record<string, unknown>>,
    audits: Array<Record<string, unknown>>
  ): Promise<Map<string, Profile>> {
    const ids = new Set<string>();

    notes.forEach((n) => {
      if (n.created_by) ids.add(n.created_by as string);
    });
    tasks.forEach((t) => {
      if (t.created_by) ids.add(t.created_by as string);
      if (t.assigned_to) ids.add(t.assigned_to as string);
    });
    audits.forEach((a) => {
      if (a.performed_by) ids.add(a.performed_by as string);
    });

    if (ids.size === 0) return new Map();
    return this.profileRepo.getProfilesByIds(Array.from(ids));
  }

  private enrichNotes(
    notes: Array<Record<string, unknown>>,
    profilesMap: Map<string, Profile>
  ): TimelineNote[] {
    return notes.map((n) => {
      const createdBy = n.created_by as string | null;
      const profile = createdBy ? profilesMap.get(createdBy) : undefined;
      const author: AuthorInfo | null = profile
        ? profileToAuthor(profile)
        : createdBy
        ? fallbackAuthor(createdBy)
        : null;
      return { ...(n as unknown as TimelineNote), author };
    });
  }

  private enrichTasks(
    tasks: Array<Record<string, unknown>>,
    profilesMap: Map<string, Profile>
  ): TimelineTask[] {
    return tasks.map((t) => {
      const createdBy = t.created_by as string | null;
      const profile = createdBy ? profilesMap.get(createdBy) : undefined;
      const author: AuthorInfo | null = profile
        ? profileToAuthor(profile)
        : createdBy
        ? fallbackAuthor(createdBy)
        : null;
      return { ...(t as unknown as TimelineTask), author };
    });
  }

  private enrichAudits(
    audits: Array<Record<string, unknown>>,
    profilesMap: Map<string, Profile>
  ): TimelineAudit[] {
    return audits.map((a) => {
      const performedBy = a.performed_by as string | null;
      const profile = performedBy ? profilesMap.get(performedBy) : undefined;
      const author: AuthorInfo | null = profile
        ? profileToAuthor(profile)
        : performedBy
        ? fallbackAuthor(performedBy)
        : null;
      return { ...(a as unknown as TimelineAudit), author };
    });
  }

  private mergeAndSort(
    notes: TimelineNote[],
    tasks: TimelineTask[],
    audits: TimelineAudit[],
    inquiries: TimelineInquiry[],
    limit: number,
    offset: number
  ): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    notes.forEach((n) => entries.push({ type: 'note', timestamp: n.created_at, data: n }));

    tasks.forEach((t) => {
      entries.push({ type: 'task', timestamp: t.created_at, data: t, isCompletionEvent: false });
      if (t.status === 'completed' && t.completed_at) {
        entries.push({ type: 'task', timestamp: t.completed_at, data: t, isCompletionEvent: true });
      }
    });

    audits.forEach((a) => entries.push({ type: 'audit', timestamp: a.performed_at, data: a }));
    inquiries.forEach((i) => entries.push({ type: 'inquiry', timestamp: i.received_at, data: i }));

    // Sort by timestamp DESC
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Paginate
    return entries.slice(offset, offset + limit);
  }
}
