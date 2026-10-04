import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createSupabaseServer();

  let isSessionEstablished = false;
  let userId = null;

  // Handle PKCE flow (e.g., OAuth or standard email links with PKCE enabled)
  if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      isSessionEstablished = true;
      userId = data.user.id;
    } else {
      return NextResponse.redirect(`${origin}/login?error=exchange_failed&details=${encodeURIComponent(error?.message || "unknown")}`);
    }
  } 
  // Handle OTP / Token Hash flow (e.g., Custom email templates)
  else if (token_hash && type) {
    const { error, data } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });
    if (!error && data.user) {
      isSessionEstablished = true;
      userId = data.user.id;
    } else {
      return NextResponse.redirect(`${origin}/login?error=otp_failed&details=${encodeURIComponent(error?.message || "unknown")}`);
    }
  } else {
    // Check if they already have a session (e.g., coming from /update-password)
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      isSessionEstablished = true;
      userId = data.user.id;
    }
  }

  if (isSessionEstablished && userId) {
    // Check for pending invitations and activate them
    const { data: invitations } = await supabase
      .from("agency_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "invited");

    if (invitations && invitations.length > 0) {
      // Activate all pending invitations for this user
      for (const inv of invitations) {
        await supabase
          .from("agency_memberships")
          .update({ 
            status: "active",
            joined_at: new Date().toISOString()
          })
          .eq("id", inv.id);
      }
      
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
