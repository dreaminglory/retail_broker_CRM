'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function syncLocaleCookieAction() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('locale')
      .eq('id', user.id)
      .single();

    if (profile?.locale) {
      const cookieStore = await cookies();
      cookieStore.set('NEXT_LOCALE', profile.locale, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    }
  }
}
