import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with the Service Role key.
 * 
 * WARNING: This client bypasses all Row Level Security (RLS) policies.
 * It should only be used in secure Server Actions or Route Handlers where
 * the user's authorization has already been verified in application code.
 * 
 * Never expose the service_role key to the browser.
 */
export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase admin environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
