import { z } from 'zod';
import { cache } from 'react';
import { createSupabaseServer } from '@/lib/supabase/server';

export const agencySettingsSchema = z.object({
  timezone: z.string().default('Europe/Sofia'),
  default_currency: z.enum(['EUR', 'BGN']).default('EUR'),
});

export type AgencySettings = z.infer<typeof agencySettingsSchema>;

export const getAgencySettings = cache(async (agencyId: string): Promise<AgencySettings> => {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('agencies')
    .select('settings')
    .eq('id', agencyId)
    .single();

  if (error || !data) {
    console.error('Failed to load agency settings:', error);
    // Return default settings if parsing fails or data is missing
    return agencySettingsSchema.parse({});
  }

  const parsed = agencySettingsSchema.safeParse(data.settings);
  if (!parsed.success) {
    console.error('Failed to parse agency settings:', parsed.error);
    return agencySettingsSchema.parse({});
  }

  return parsed.data;
});
