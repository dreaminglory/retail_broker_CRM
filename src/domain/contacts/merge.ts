import { DomainError, rpcFailure } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ContactRepository } from './repository';
import type { MergePreview, MergeHistory } from './merge-types';
import type { ContactMethod } from './types';

export class ContactMergeService {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Generates a preview of what will happen if loser is merged into winner.
   */
  async getPreview(
    agencyId: string,
    winnerId: string,
    loserId: string
  ): Promise<MergePreview> {
    const repo = new ContactRepository(this.db);
    
    // Ensure both contacts exist
    const winner = await repo.findById(winnerId, agencyId);
    const loser = await repo.findById(loserId, agencyId);

    if (!winner || !loser) {
      throw new DomainError('errors.not_found', 'Winner or loser contact not found.');
    }

    // Count items to transfer
    const { count: opportunitiesCount, error: opportunitiesError } = await this.db
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('primary_contact_id', loserId);

    if (opportunitiesError) throw new DomainError('errors.loadFailed', `Merge preview opportunities count failed: ${opportunitiesError.message}`);

    const { count: inquiriesCount, error: inquiriesError } = await this.db
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('contact_id', loserId);

    if (inquiriesError) throw new DomainError('errors.loadFailed', `Merge preview inquiries count failed: ${inquiriesError.message}`);

    const { count: tasksCount, error: tasksError } = await this.db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('contact_id', loserId);

    if (tasksError) throw new DomainError('errors.loadFailed', `Merge preview tasks count failed: ${tasksError.message}`);

    // Calculate unique contact methods to transfer
    let contactMethodsToTransfer = 0;
    loser.contact_methods.forEach(loserMethod => {
      const isDuplicate = winner.contact_methods.some(
        winnerMethod => 
          winnerMethod.type === loserMethod.type && 
          winnerMethod.value === loserMethod.value
      );
      if (!isDuplicate) {
        contactMethodsToTransfer++;
      }
    });

    return {
      winnerId,
      loserId,
      opportunitiesToTransfer: opportunitiesCount ?? 0,
      inquiriesToTransfer: inquiriesCount ?? 0,
      tasksToTransfer: tasksCount ?? 0,
      contactMethodsToTransfer,
    };
  }

  /**
   * Executes the merge of loser into winner.
   * All of it happens in the `merge_contacts` RPC, or none of it does (AD-050).
   */
  async merge(agencyId: string, winnerId: string, loserId: string): Promise<void> {
    const { error } = await this.db.rpc('merge_contacts', {
      p_agency_id: agencyId,
      p_winner_id: winnerId,
      p_loser_id: loserId,
    });
    if (error) throw rpcFailure(error);
  }
}
