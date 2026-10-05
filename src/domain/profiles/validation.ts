import { z } from 'zod';

/**
 * Zod schemas for profile validation.
 * AD-023: Profile updates are limited to display_name (2-100 chars).
 */

export const updateProfileSchema = z.object({
  display_name: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name cannot exceed 100 characters')
    .transform((val) => val.trim()),
});

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;

export const updateLocaleSchema = z.object({
  locale: z.enum(['bg', 'en'], {
    errorMap: () => ({ message: 'invalidLocale' }),
  }),
});

export type UpdateLocaleSchema = z.infer<typeof updateLocaleSchema>;
