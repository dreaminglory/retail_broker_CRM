import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditLogEntry, AuditLogEntryWithAuthor, AuditEntityType } from './types';
import { ProfileRepository } from '@/domain/profiles/repository';
import type { Profile } from '@/domain/profiles/types';

function profileToAuthor(profile: Profile): { id: string; email: string; display_name: string } {
  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name || profile.email.split('@')[0],
  };
}

export class AuditRepository {
  private readonly profileRepo: ProfileRepository;

  constructor(private readonly supabase: SupabaseClient) {
    this.profileRepo = new ProfileRepository(supabase);
  }

  async findByEntity(
    agencyId: string,
    entityType: AuditEntityType,
    entityId: string,
    limit = 50
  ): Promise<AuditLogEntryWithAuthor[]> {
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch audit logs for ${entityType}: ${error.message}`);
    return this.enrichWithProfiles(data ?? []);
  }

  async findByPerformer(
    agencyId: string,
    performerId: string,
    limit = 50
  ): Promise<AuditLogEntryWithAuthor[]> {
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('performed_by', performerId)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch audit logs for performer: ${error.message}`);
    return this.enrichWithProfiles(data ?? []);
  }

  /**
   * Batch-resolves performed_by UUIDs against public.profiles.
   * One extra DB round-trip per call, regardless of result count.
   */
  private async enrichWithProfiles(
    entries: AuditLogEntry[]
  ): Promise<AuditLogEntryWithAuthor[]> {
    const performerIds = [...new Set(
      entries.map((e) => e.performed_by).filter((id): id is string => id !== null)
    )];

    const profilesMap = await this.profileRepo.getProfilesByIds(performerIds);

    return entries.map((entry) => {
      const profile = entry.performed_by ? profilesMap.get(entry.performed_by) : undefined;
      const author = profile ? profileToAuthor(profile) : null;
      return { ...entry, author };
    });
  }
}
