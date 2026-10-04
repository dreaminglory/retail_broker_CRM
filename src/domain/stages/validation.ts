import { z } from 'zod';

// ── Terminal type enum ────────────────────────────────────────────────────────

export const TERMINAL_TYPES = ['won', 'lost', 'nurture'] as const;

export const terminalTypeSchema = z
  .enum(TERMINAL_TYPES)
  .nullable()
  .optional();

// ── Create stage ──────────────────────────────────────────────────────────────

export const createStageSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Stage name is required')
      .max(100, 'Stage name must be 100 characters or fewer'),
    sort_order: z.number().int().nonnegative().optional(),
    is_terminal: z.boolean().optional().default(false),
    terminal_type: terminalTypeSchema,
  })
  .refine(
    (data) => {
      // If terminal, terminal_type must be set
      if (data.is_terminal && !data.terminal_type) return false;
      // If not terminal, terminal_type should not be set
      if (!data.is_terminal && data.terminal_type) return false;
      return true;
    },
    {
      message:
        'Terminal stages must have a terminal type (won/lost/nurture); non-terminal stages must not.',
      path: ['terminal_type'],
    }
  );

// ── Update stage ──────────────────────────────────────────────────────────────

export const updateStageSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Stage name is required')
      .max(100, 'Stage name must be 100 characters or fewer')
      .optional(),
    is_terminal: z.boolean().optional(),
    terminal_type: terminalTypeSchema,
  })
  .refine(
    (data) => {
      // Only validate the constraint if both fields are provided
      if (data.is_terminal === true && data.terminal_type === null) return false;
      if (data.is_terminal === false && data.terminal_type != null) return false;
      return true;
    },
    {
      message:
        'Terminal stages must have a terminal type; non-terminal stages must not.',
      path: ['terminal_type'],
    }
  );

// ── Reorder stages ────────────────────────────────────────────────────────────

export const reorderStagesSchema = z.object({
  stages: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.number().int().nonnegative(),
      })
    )
    .min(1, 'At least one stage is required'),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;
