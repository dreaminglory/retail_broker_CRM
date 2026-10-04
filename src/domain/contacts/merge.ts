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
      throw new Error('Winner or loser contact not found.');
    }

    // Count items to transfer
    const { count: opportunitiesCount } = await this.db
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('primary_contact_id', loserId);

    const { count: inquiriesCount } = await this.db
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('contact_id', loserId);

    const { count: tasksCount } = await this.db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('contact_id', loserId);

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
   * Note: Executed sequentially. In production, consider an RPC for atomic transactions.
   */
  async merge(
    agencyId: string,
    userId: string,
    winnerId: string,
    loserId: string
  ): Promise<void> {
    if (winnerId === loserId) {
      throw new Error('Cannot merge a contact with itself.');
    }

    const repo = new ContactRepository(this.db);
    
    const winner = await repo.findById(winnerId, agencyId);
    const loser = await repo.findById(loserId, agencyId);

    if (!winner || !loser) {
      throw new Error('Winner or loser contact not found.');
    }

    // 1. Snapshot loser contact
    const loserSnapshot = loser;

    // 2. Transfer contact methods (skip exact duplicates)
    for (const loserMethod of loser.contact_methods) {
      const isDuplicate = winner.contact_methods.some(
        winnerMethod => 
          winnerMethod.type === loserMethod.type && 
          winnerMethod.value === loserMethod.value
      );

      if (!isDuplicate) {
        // Move to winner
        await this.db
          .from('contact_methods')
          .update({ contact_id: winnerId, is_primary: false })
          .eq('id', loserMethod.id)
          .eq('agency_id', agencyId);
      } else {
        // Delete duplicate method from loser to avoid orphaned or conflicting records
        await this.db
          .from('contact_methods')
          .delete()
          .eq('id', loserMethod.id)
          .eq('agency_id', agencyId);
      }
    }

    // 3. Transfer opportunities
    await this.db
      .from('opportunities')
      .update({ primary_contact_id: winnerId })
      .eq('primary_contact_id', loserId)
      .eq('agency_id', agencyId);

    // 4. Transfer opportunity_participants
    // First find if there are duplicate participation
    const { data: loserParticipants } = await this.db
      .from('opportunity_participants')
      .select('id, opportunity_id, role')
      .eq('contact_id', loserId)
      .eq('agency_id', agencyId);

    if (loserParticipants && loserParticipants.length > 0) {
      const { data: winnerParticipants } = await this.db
        .from('opportunity_participants')
        .select('opportunity_id')
        .eq('contact_id', winnerId)
        .eq('agency_id', agencyId);
        
      const winnerOppIds = new Set(winnerParticipants?.map(p => p.opportunity_id) ?? []);

      for (const p of loserParticipants) {
        if (winnerOppIds.has(p.opportunity_id)) {
          // Both are in the same opportunity, delete the loser's participation
          await this.db
            .from('opportunity_participants')
            .delete()
            .eq('id', p.id)
            .eq('agency_id', agencyId);
        } else {
          // Transfer to winner
          await this.db
            .from('opportunity_participants')
            .update({ contact_id: winnerId })
            .eq('id', p.id)
            .eq('agency_id', agencyId);
        }
      }
    }

    // 5. Transfer inquiries
    await this.db
      .from('inquiries')
      .update({ contact_id: winnerId })
      .eq('contact_id', loserId)
      .eq('agency_id', agencyId);

    // 6. Transfer tasks
    await this.db
      .from('tasks')
      .update({ contact_id: winnerId })
      .eq('contact_id', loserId)
      .eq('agency_id', agencyId);

    // 7. Archive loser contact
    await this.db
      .from('contacts')
      .update({ status: 'archived' })
      .eq('id', loserId)
      .eq('agency_id', agencyId);

    // 8. Insert merge history record
    await this.db
      .from('merge_history')
      .insert({
        agency_id: agencyId,
        winner_contact_id: winnerId,
        loser_contact_id: loserId,
        merged_by: userId,
        loser_snapshot: loserSnapshot,
      });
  }
}
