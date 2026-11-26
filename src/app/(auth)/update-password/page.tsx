"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { authErrorKey } from "@/lib/auth-errors";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const t = useTranslations("auth.updatePassword");
  const tErrors = useTranslations("auth.errors");

  const [noSession, setNoSession] = useState(false);

  useEffect(() => {
    // Check if the user is already authenticated
    const supabase = createSupabaseBrowser();
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setNoSession(true);
        setInitializing(false);
      } else {
        setInitializing(false);
      }
    });
  }, [router]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError(tErrors("weak_password"));
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(tErrors(authErrorKey(error)));
      setLoading(false);
      return;
    }

    toast.success(t("updated"));
    
    // Check if there's a next path or just go to callback to activate pending invitations
    router.push("/auth/callback?next=/dashboard");
  }

  if (initializing) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-card flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("verifying")}</p>
      </div>
    );
  }

  if (noSession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-card flex flex-col items-center text-center space-y-4">
        <div className="rounded-full bg-destructive/10 p-3">
          <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-title text-ink">{t("invalidTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("invalidSubtitle")}
        </p>
        <Button
          onClick={() => router.push("/login")}
          className="h-10 w-full"
        >
          {t("returnLogin")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-card">
      <div className="mb-6">
        <h2 className="text-title text-ink">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">
            {t("password")}
          </Label>
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
    </div>
  );
}
