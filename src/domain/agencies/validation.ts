import { z } from 'zod';

export const createAgencySchema = z.object({
  agency_name: z.string().min(2, 'Agency name must be at least 2 characters').max(120, 'Agency name must be less than 120 characters'),
  locale: z.enum(['bg', 'en']).default('bg'),
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
