import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isSafeRelativePath } from "@/lib/safe-redirect";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  
  // Use safe relative path or fallback to dashboard
  const next = isSafeRelativePath(rawNext) ? rawNext : "/dashboard";

  const supabase = await createSupabaseServer();

  let isSessionEstablished = false;
  let userId = null;

  // Handle PKCE flow
  if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      isSessionEstablished = true;
      userId = data.user.id;
    } else {
      return NextResponse.redirect(`${origin}/login?error=exchange_failed&details=${encodeURIComponent(error?.message || "unknown")}`);
    }
  } 
  // Handle OTP / Token Hash flow
  else if (token_hash && type) {
    const { error, data } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (!error && data.user) {
      isSessionEstablished = true;
      userId = data.user.id;
    } else {
      return NextResponse.redirect(`${origin}/login?error=otp_failed&details=${encodeURIComponent(error?.message || "unknown")}`);
    }
  } else {
    // Check if they already have a session
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      isSessionEstablished = true;
      userId = data.user.id;
    }
  }

  if (isSessionEstablished && userId) {
    // Check for and accept pending invitations using the secure RPC
    const { data: activatedCount, error: rpcError } = await supabase.rpc('accept_pending_invitations');
    
    // Sync locale from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('locale')
      .eq('id', userId)
      .single();
      
    if (profile?.locale) {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      cookieStore.set('NEXT_LOCALE', profile.locale, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    }

    if (activatedCount && activatedCount > 0) {
      // Redirect to next path if explicit (e.g. /update-password), otherwise to profile settings
      if (next === "/update-password") {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}/settings/profile`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // Return to login with error if auth fails
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed_no_code`);
}
