/**
 * Task domain types.
 * AD-005: Minimal task entity in Sprint 1.
 * Sprint 2: Enhanced with task types, mandatory outcomes, and
 * the "complete → schedule next" workflow (AD-014).
 */

export type TaskStatus = 'pending' | 'completed' | 'cancelled';

/** AD-013: Task type categorization for UI display and filtering. */
export type TaskType = 'call' | 'follow_up' | 'viewing' | 'meeting' | 'email' | 'other';

export interface Task {
  id: string;
  agency_id: string;

  /** FK → opportunities. Null for standalone tasks (rare in Sprint 1). */
  opportunity_id: string | null;

  /** FK → contacts. Optional context. */
  contact_id: string | null;

  title: string;
  description: string | null;

  /** AD-013: Categorizes the task for display and filtering. */
  task_type: TaskType | null;

  /** When the task is due. */
  due_at: string | null;

  status: TaskStatus;

  /**
   * Notes recorded when completing the task.
   * Required in Sprint 2 completion workflows (AD-014).
   */
  outcome: string | null;

  completed_at: string | null;

  /** FK → auth.users. Task owner (broker). */
  assigned_to: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Task with joined opportunity data (for Today Screen). */
export interface TaskWithOpportunity extends Task {
  opportunity_title: string | null;
  opportunity_stage: string | null;
}

/**
 * Task with resolved author names from public.profiles (Slice 4.2).
 * Used in detail views and the activity timeline.
 */
export interface TaskWithProfiles extends Task {
  assignee_name: string | null;
  creator_name: string | null;
}

/** Input for creating a task. */
export interface CreateTaskInput {
  opportunity_id?: string | null;
  contact_id?: string | null;
  title: string;
  description?: string | null;
  task_type?: TaskType | null;
  due_at?: string | null;
  assigned_to?: string | null;
}

/** Input for completing a task (AD-014: outcome is required). */
export interface CompleteTaskInput {
  outcome: string;
}

/**
 * Input for the full "complete task → schedule next" workflow.
 * AD-014: Soft enforcement — the next step fields are optional
 * but the UI prominently prompts for them.
 */
export interface CompleteTaskWithNextInput {
  /** Required: what happened when this task was executed. */
  outcome: string;

  /** Optional: schedule a follow-up task. */
  next_task?: CreateTaskInput | null;

  /** Optional: advance the opportunity to a new stage. */
  new_stage_id?: string | null;
}
