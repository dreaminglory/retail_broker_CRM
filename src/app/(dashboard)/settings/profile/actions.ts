"use server";

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { ProfileRepository } from '@/domain/profiles/repository';
import { updateProfileSchema } from '@/domain/profiles/validation';
import { DomainError } from '@/lib/errors';

/**
 * Server Action: Update the current user's profile display name.
 * AD-023: Profile updates are user-level, not tenant-scoped.
 */
export async function updateProfile(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return toActionError(new DomainError('errors.unauthorized'));
  }

  const raw = {
    display_name: formData.get('display_name'),
  };

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const result = await toActionError(parsed.error);
    return { error: result.fieldErrors?.display_name?.[0] ?? result.error };
  }

  try {
    const repo = new ProfileRepository(supabase);
    await repo.updateProfile(user.id, parsed.data);
    revalidatePath('/settings/profile');
    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (err) {
    return toActionError(err);
  }
}

import { cookies } from 'next/headers';
import { updateDigestEnabledSchema, updateLocaleSchema } from '@/domain/profiles/validation';
import { toActionError, ActionResult } from '@/lib/actions';

export async function updateLocaleAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return toActionError(new DomainError('errors.unauthorized'));
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

/** The user comes from the session, never the caller, so a member changes only their own digest. */
export async function updateDigestEnabledAction(enabled: boolean): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return toActionError(new DomainError('errors.unauthorized'));
  }

  const parsed = updateDigestEnabledSchema.safeParse({ digest_enabled: enabled });
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const repo = new ProfileRepository(supabase);
    await repo.updateDigestEnabled(user.id, parsed.data.digest_enabled);
    revalidatePath('/settings/profile');
    return { success: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
