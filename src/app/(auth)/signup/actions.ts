"use server";

import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AgencyService } from "@/domain/agencies/service";
import { toActionError } from "@/lib/actions";
import { authErrorKey } from "@/lib/auth-errors";
import { DomainError } from "@/lib/errors";

export async function signupAction(formData: FormData): Promise<{ success?: boolean; requireConfirmation?: boolean; error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const agencyName = formData.get("agencyName") as string;

  const supabase = await createSupabaseServer();
  
  // 1. Create auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return toActionError(new DomainError(`auth.errors.${authErrorKey(error)}`, error.message));
  }

  // 2. If a session is established immediately (email confirmation disabled), create agency.
  if (data.session) {
    try {
      const cookieStore = await cookies();
      const locale = (cookieStore.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'bg');
      await AgencyService.createWithOwner(agencyName, locale);
      return { success: true };
    } catch (err) {
      return toActionError(err);
    }
  }

  // If email confirmation is enabled, we'd normally store agencyName in metadata
  // and handle creation in an /onboarding page upon first sign in.
  // For now, we assume auto-login is on or they verify email first.
  return { success: true, requireConfirmation: true };
}
