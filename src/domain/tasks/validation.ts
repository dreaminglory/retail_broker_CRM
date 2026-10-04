import { z } from 'zod';

// ── Task type enum ─────────────────────────────────────────────────────────
// AD-013: Task type categorization
export const TASK_TYPES = ['call', 'follow_up', 'viewing', 'meeting', 'email', 'other'] as const;

export const taskTypeSchema = z.enum(TASK_TYPES).nullable().optional();

// ── Create task ────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  opportunity_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(300, 'Title must be 300 characters or fewer'),
  description: z.string().max(5000).nullable().optional(),
  task_type: taskTypeSchema,
  due_at: z
    .string()
    .refine((val) => val === '' || !isNaN(Date.parse(val)), { message: 'Invalid date/time' })
    .transform((val) => (val === '' ? null : new Date(val).toISOString()))
    .nullable()
    .optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

// ── Complete task (AD-014: outcome required in Sprint 2) ───────────────────

export const completeTaskSchema = z.object({
  outcome: z
    .string()
    .min(1, 'Outcome is required — describe what happened')
    .max(5000, 'Outcome must be 5000 characters or fewer'),
});

// ── Complete task with next action (full workflow) ──────────────────────────
// AD-014: Soft enforcement — next_task and new_stage_id are optional.
// The UI prompts for them but allows skipping.

export const completeTaskWithNextSchema = z.object({
  outcome: z
    .string()
    .min(1, 'Outcome is required — describe what happened')
    .max(5000, 'Outcome must be 5000 characters or fewer'),
  next_task: createTaskSchema.nullable().optional(),
  new_stage_id: z.string().uuid().nullable().optional(),
});

// ── Update task ────────────────────────────────────────────────────────────

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(300, 'Title must be 300 characters or fewer')
    .optional(),
  description: z.string().max(5000).nullable().optional(),
  task_type: taskTypeSchema,
  due_at: z
    .string()
    .refine((val) => val === '' || !isNaN(Date.parse(val)), { message: 'Invalid date/time' })
    .transform((val) => (val === '' ? null : new Date(val).toISOString()))
    .nullable()
    .optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export type CreateTaskSchema = z.infer<typeof createTaskSchema>;
export type CompleteTaskSchema = z.infer<typeof completeTaskSchema>;
export type CompleteTaskWithNextSchema = z.infer<typeof completeTaskWithNextSchema>;
export type UpdateTaskSchema = z.infer<typeof updateTaskSchema>;
