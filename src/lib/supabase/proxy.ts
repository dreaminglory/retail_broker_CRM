import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the Supabase session on every request (AD-030, FR-AUT-03).
 *
 * Server Components cannot write cookies, so without this an access token that
 * expires between requests is never rotated and the user is logged out. The
 * refreshed cookies go both to the request (so this render sees the new
 * session) and to the response (so the browser stores it). Authorization stays
 * in the layouts and RLS; this only keeps the session alive.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not remove: getUser() validates the token and refreshes it when expired.
  await supabase.auth.getUser()

  return response
}
