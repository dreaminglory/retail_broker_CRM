"use server";

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { ProfileRepository } from '@/domain/profiles/repository';
import { updateProfileSchema } from '@/domain/profiles/validation';

/**
 * Server Action: Update the current user's profile display name.
 * AD-023: Profile updates are user-level, not tenant-scoped.
 */
export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const raw = {
    display_name: formData.get('display_name'),
  };

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  try {
    const repo = new ProfileRepository(supabase);
    await repo.updateProfile(user.id, parsed.data);
    revalidatePath('/settings/profile');
    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return { error: message };
  }
}

import { cookies } from 'next/headers';
import { updateLocaleSchema } from '@/domain/profiles/validation';
import { toActionError, ActionResult } from '@/lib/actions';

export async function updateLocaleAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const locale = formData.get('locale');
  const parsed = updateLocaleSchema.safeParse({ locale });

  if (!parsed.success) return toActionError(parsed.error);

  try {
    const repo = new ProfileRepository(supabase);
    await repo.updateLocale(user.id, parsed.data.locale);
    
    const cookieStore = await cookies();
    cookieStore.set('NEXT_LOCALE', parsed.data.locale, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });

    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
