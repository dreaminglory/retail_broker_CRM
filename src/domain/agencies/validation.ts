import { z } from 'zod';

export const createAgencySchema = z.object({
  agency_name: z.string().min(2, 'validation.name_too_short').max(120, 'validation.name_too_long'),
  locale: z.enum(['bg', 'en']).default('bg'),
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
