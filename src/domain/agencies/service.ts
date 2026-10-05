import { createSupabaseServer } from '@/lib/supabase/server';
import { DomainError } from '@/lib/errors';
import { createAgencySchema } from './validation';

export const AgencyService = {
  async createWithOwner(agencyName: string, locale: 'bg' | 'en' = 'bg'): Promise<string> {
    const supabase = await createSupabaseServer();
    const validated = createAgencySchema.parse({ agency_name: agencyName, locale });
    
    const { data, error } = await supabase.rpc('create_agency_with_owner', {
      p_agency_name: validated.agency_name,
      p_locale: validated.locale
    });
    
    if (error) {
      if (error.code === '28000') {
        throw new DomainError('agencies.notAuthenticated', 'You must be logged in to create an agency.');
      }
      if (error.code === 'P0001') {
        throw new DomainError('agencies.alreadyMember', 'You are already a member of an agency.');
      }
      if (error.code === '22023') {
        throw new DomainError('agencies.invalidName', 'Invalid agency name length.');
      }
      throw error;
    }
    
    return data as string;
  }
};
