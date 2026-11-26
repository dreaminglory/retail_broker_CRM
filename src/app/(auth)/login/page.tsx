"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { authErrorKey } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("auth.login");
  const tErrors = useTranslations("auth.errors");

  useEffect(() => {
    // Check for errors in URL
    const urlError = searchParams.get("error");
    
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
              setError(tErrors("link_invalid"));
            } else if (data.session) {
              // Clear the hash from the URL so it doesn't try again if they refresh
              window.history.replaceState(null, "", window.location.pathname);
              router.push("/update-password");
              router.refresh();
            } else {
              setLoading(false);
              setError(tErrors("link_invalid"));
            }
          });
        } else {
          setLoading(false);
          setError(tErrors("link_invalid"));
        }
      } else if (hash.includes("error_description")) {
        setError(tErrors("link_invalid"));
      } else {
        setError(tErrors("link_invalid"));
      }
    } else if (urlError === "exchange_failed" || urlError === "otp_failed") {
      setError(tErrors("link_invalid"));
    }
  }, [searchParams, router, tErrors]);

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
      setError(tErrors(authErrorKey(error)));
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
    <div>
      <div className="mb-6">
        <h2 className="text-title text-ink">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">
            {t("email")}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              {t("password")}
            </Label>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          emphasis="action"
          className="h-10 w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("loading")}
            </>
          ) : (
            t("submit")
          )}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-small text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden />
        {t("noAccount")}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <Link
        href="/signup"
        className={cn(buttonVariants({ variant: "outline" }), "h-10 w-full")}
      >
        {t("createAgency")}
      </Link>
      <p className="mt-6 text-center text-small text-muted-foreground">{t("invitedHint")}</p>
    </div>
  );
}
