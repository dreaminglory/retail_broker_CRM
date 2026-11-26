"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { setAuthLocaleAction } from "./set-locale";

const LOCALES = [
  { value: "bg", label: "БГ" },
  { value: "en", label: "EN" },
] as const;

/** БГ / EN on the auth screens: sets the NEXT_LOCALE cookie and re-renders (the profile syncs it on sign-in). */
export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale();

  async function choose(next: string) {
    if (next === locale) return;
    await setAuthLocaleAction(next);
    router.refresh();
  }

  return (
    <div role="group" className="inline-flex rounded-md border border-border-strong bg-surface p-0.5 text-sm">
      {LOCALES.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={locale === item.value}
          onClick={() => choose(item.value)}
          className={cn(
            "rounded px-3 py-1 transition-colors",
            locale === item.value ? "bg-accent font-semibold text-primary" : "text-muted-foreground hover:text-ink"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
