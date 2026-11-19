"use client";

import { PhoneCall } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CallTargetBase } from "./call-targets";
import { useCallIntent } from "./use-call-intent";

/** "Log call" by hand (spec phone-loop rule 4): the same prompt, with a channel picker. */
export function LogCallButton({ target }: { target: CallTargetBase }) {
  const t = useTranslations("phoneLoop");
  const intent = useCallIntent();
  if (!intent) return null;
  return (
    <Button variant="outline" size="sm" className="min-h-11 gap-1.5 md:min-h-8" onClick={() => intent.open(target)}>
      <PhoneCall className="h-3.5 w-3.5" aria-hidden />
      {t("logCall")}
    </Button>
  );
}
