"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { authErrorKey } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const t = useTranslations("auth.forgotPassword");
  const tErrors = useTranslations("auth.errors");

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      setError(tErrors(authErrorKey(error)));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    toast.success(t("sent"));
  }

  if (success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-card flex flex-col items-center text-center">
        <CheckCircle2 className="h-12 w-12 text-success mb-4" />
        <h2 className="text-title text-ink mb-2">{t("successTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("successSubtitle")}<span className="font-medium text-foreground">{email}</span>.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline font-medium">
          {t("returnLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-card">
      <div className="mb-6">
        <h2 className="text-title text-ink">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleReset} className="space-y-4">
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

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
