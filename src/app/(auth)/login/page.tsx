"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for errors in URL
    const urlError = searchParams.get("error");
    const details = searchParams.get("details");
    
    if (urlError === "auth_callback_failed_no_code") {
      // This might be an implicit flow redirect. Check the hash.
      const hash = window.location.hash;
      if (hash.includes("access_token")) {
        setLoading(true);
        const supabase = createSupabaseBrowser();
        
        // Manually extract tokens to guarantee it works without timing issues
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          }).then(({ data, error: sessionError }) => {
            if (sessionError) {
              setLoading(false);
              setError("Failed to establish session: " + sessionError.message);
            } else if (data.session) {
              // Clear the hash from the URL so it doesn't try again if they refresh
              window.history.replaceState(null, "", window.location.pathname);
              router.push("/update-password");
              router.refresh();
            } else {
              setLoading(false);
              setError("Failed to process invitation token. It may have expired.");
            }
          });
        } else {
          setLoading(false);
          setError("Invalid token format in URL.");
        }
      } else if (hash.includes("error_description")) {
        // Parse error from hash
        const params = new URLSearchParams(hash.substring(1));
        const desc = params.get("error_description");
        setError(desc ? desc.replace(/\+/g, " ") : "The link is invalid or expired.");
      } else {
        setError("Authentication failed. Please try again or request a new link.");
      }
    } else if (urlError === "exchange_failed" || urlError === "otp_failed") {
      setError(`Authentication failed: ${details || "Unknown error"}`);
    }
  }, [searchParams, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    try {
      const { syncLocaleCookieAction } = await import('./sync-locale');
      await syncLocaleCookieAction();
    } catch (err) {
      console.error('Failed to sync locale cookie', err);
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">
          Sign in to your BrokerCRM account
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create your agency
        </Link>
      </p>
    </div>
  );
}
