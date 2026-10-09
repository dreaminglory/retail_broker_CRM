import { z } from 'zod';

/**
 * Zod schemas for profile validation.
 * AD-023: Profile updates are limited to display_name (2-100 chars).
 */

export const updateProfileSchema = z.object({
  display_name: z
    .string()
    .min(2, 'validation.name_too_short')
    .max(100, 'validation.name_too_long')
    .transform((val) => val.trim()),
});

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;

export const updateLocaleSchema = z.object({
  locale: z.enum(['bg', 'en'], {
    errorMap: () => ({ message: 'validation.invalid_locale' }),
  }),
});

export type UpdateLocaleSchema = z.infer<typeof updateLocaleSchema>;
