import type { SupabaseClient } from '@supabase/supabase-js';
import { ProfileRepository } from '@/domain/profiles/repository';
import type { Profile } from '@/domain/profiles/types';
import { getStaleThreshold } from '@/lib/time/agency-day';

export interface UnassignedInquiry {
  id: string;
  caller_name: string | null;
  subject: string | null;
  received_at: string;
  source_description: string | null;
}

export interface OverdueTasksByBroker {
  broker_id: string;
  broker_name: string;
  overdue_count: number;
  most_overdue_task: {
    id: string;
    title: string;
    due_at: string;
  } | null;
}

export interface StaleOpportunity {
  id: string;
  title: string;
  stage_name: string;
  updated_at: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
}

export interface AtRiskOpportunity {
  id: string;
  title: string;
  stage_name: string;
  created_at: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
}

export interface WorkloadDistribution {
  broker_id: string;
  broker_name: string;
  active_opportunities: number;
  pending_tasks: number;
}

export interface ExceptionData {
  unassignedInquiries: UnassignedInquiry[];
  overdueTasksByBroker: OverdueTasksByBroker[];
  atRiskOpportunities: AtRiskOpportunity[];
  staleOpportunities: StaleOpportunity[];
  workloadDistribution: WorkloadDistribution[];
}

export class ExceptionsRepository {
  private readonly profileRepo: ProfileRepository;

  constructor(private readonly db: SupabaseClient) {
    this.profileRepo = new ProfileRepository(db);
  }

  async getDashboardData(agencyId: string, timezone: string = 'Europe/Sofia'): Promise<ExceptionData> {
    // 1. Unassigned Inquiries (status = 'new', assigned_to IS NULL)
    const { data: unassignedInquiriesData, error: err1 } = await this.db
      .from('inquiries')
      .select('id, caller_name, subject, received_at, source_description')
      .eq('agency_id', agencyId)
      .eq('status', 'new')
      .is('assigned_to', null)
      .order('received_at', { ascending: true });
    
    if (err1) throw new Error(`Failed to fetch unassigned inquiries: ${err1.message}`);

    // 2. Overdue Tasks (grouped by broker)
    const { data: overdueTasksData, error: err2 } = await this.db
      .from('tasks')
      .select('id, title, due_at, assigned_to')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .lt('due_at', new Date().toISOString())
      .not('assigned_to', 'is', null)
      .order('due_at', { ascending: true });
      
    if (err2) throw new Error(`Failed to fetch overdue tasks: ${err2.message}`);

    const brokerTasksMap = new Map<string, OverdueTasksByBroker>();
    for (const task of (overdueTasksData || [])) {
      const brokerId = task.assigned_to!;
      if (!brokerTasksMap.has(brokerId)) {
        brokerTasksMap.set(brokerId, {
          broker_id: brokerId,
          broker_name: brokerId, // resolved below after profiles batch lookup
          overdue_count: 0,
          most_overdue_task: {
            id: task.id,
            title: task.title,
            due_at: task.due_at,
          },
        });
      }
      brokerTasksMap.get(brokerId)!.overdue_count++;
    }
    const overdueTasksByBroker = Array.from(brokerTasksMap.values());

    // 3 & 4. Active Opportunities (At Risk and Stale)
    // Fetch active opportunities with no pending tasks (next_action_at IS NULL)
    const { data: oppsData, error: err3 } = await this.db
      .from('opportunities')
      .select('id, title, updated_at, created_at, assigned_to, stages!inner(name)')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .is('next_action_at', null);

    if (err3) throw new Error(`Failed to fetch active opportunities without next actions: ${err3.message}`);

    const atRiskOpportunities: AtRiskOpportunity[] = [];
    const staleOpportunities: StaleOpportunity[] = [];

    const staleThreshold = getStaleThreshold(timezone, 7);

    for (const opp of (oppsData || [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stageName = (opp.stages as any)?.name ?? 'Unknown';
      const oppDate = opp.updated_at; // Comparing ISO strings directly

      if (oppDate < staleThreshold) {
        staleOpportunities.push({
          id: opp.id,
          title: opp.title,
          stage_name: stageName,
          updated_at: opp.updated_at,
          assigned_to: opp.assigned_to,
          assigned_to_name: null, // resolved below in profiles batch lookup
        });
      } else {
        atRiskOpportunities.push({
          id: opp.id,
          title: opp.title,
          stage_name: stageName,
          created_at: opp.created_at,
          assigned_to: opp.assigned_to,
          assigned_to_name: null, // resolved below in profiles batch lookup
        });
      }
    }

    // Sort
    atRiskOpportunities.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    staleOpportunities.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

    // 5. Workload Distribution
    const workloadMap = new Map<string, { active_opportunities: number; pending_tasks: number }>();
    
    // Active Opps count
    const { data: allActiveOpps, error: err4 } = await this.db
      .from('opportunities')
      .select('assigned_to')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .not('assigned_to', 'is', null);
      
    if (err4) throw new Error(`Failed to fetch active opps for workload: ${err4.message}`);
    
    for (const opp of (allActiveOpps || [])) {
      const brokerId = opp.assigned_to!;
      if (!workloadMap.has(brokerId)) workloadMap.set(brokerId, { active_opportunities: 0, pending_tasks: 0 });
      workloadMap.get(brokerId)!.active_opportunities++;
    }

    // Pending Tasks count
    const { data: allPendingTasks, error: err5 } = await this.db
      .from('tasks')
      .select('assigned_to')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .not('assigned_to', 'is', null);
      
    if (err5) throw new Error(`Failed to fetch pending tasks for workload: ${err5.message}`);
    
    for (const task of (allPendingTasks || [])) {
      const brokerId = task.assigned_to!;
      if (!workloadMap.has(brokerId)) workloadMap.set(brokerId, { active_opportunities: 0, pending_tasks: 0 });
      workloadMap.get(brokerId)!.pending_tasks++;
    }

    const workloadDistribution: WorkloadDistribution[] = Array.from(workloadMap.entries()).map(([broker_id, counts]) => ({
      broker_id,
      broker_name: broker_id, // will be resolved below
      ...counts,
    })).sort((a, b) => (b.active_opportunities + b.pending_tasks) - (a.active_opportunities + a.pending_tasks));

    // Batch-resolve all broker UUIDs in one query
    const allBrokerIds = new Set<string>();
    overdueTasksByBroker.forEach((b) => allBrokerIds.add(b.broker_id));
    atRiskOpportunities.forEach((o) => { if (o.assigned_to) allBrokerIds.add(o.assigned_to); });
    staleOpportunities.forEach((o) => { if (o.assigned_to) allBrokerIds.add(o.assigned_to); });
    workloadDistribution.forEach((w) => allBrokerIds.add(w.broker_id));

    const profilesMap = await this.profileRepo.getProfilesByIds(Array.from(allBrokerIds));

    function resolveName(id: string | null, profiles: Map<string, Profile>): string | null {
      if (!id) return null;
      const p = profiles.get(id);
      return p ? (p.display_name || p.email.split('@')[0]) : id.substring(0, 8);
    }

    return {
      unassignedInquiries: unassignedInquiriesData || [],
      overdueTasksByBroker: overdueTasksByBroker.map((b) => ({
        ...b,
        broker_name: resolveName(b.broker_id, profilesMap) ?? b.broker_id,
      })),
      atRiskOpportunities: atRiskOpportunities.map((o) => ({
        ...o,
        assigned_to_name: resolveName(o.assigned_to, profilesMap),
      })),
      staleOpportunities: staleOpportunities.map((o) => ({
        ...o,
        assigned_to_name: resolveName(o.assigned_to, profilesMap),
      })),
      workloadDistribution: workloadDistribution.map((w) => ({
        ...w,
        broker_name: resolveName(w.broker_id, profilesMap) ?? w.broker_id,
      })),
    };
  }
}
