"use client";

import { useTranslations } from "next-intl";

/**
 * Outcomes the database writes as i18n keys, because triggers don't know the reader's locale
 * (AGENTS.md: RPCs return keys). Every other outcome is the broker's own text.
 */
const OUTCOME_KEYS = new Set(["phoneLoop.cancelledByDismiss"]);

export function translateOutcome(outcome: string, t: (key: string) => string): string {
  return OUTCOME_KEYS.has(outcome) ? t(outcome) : outcome;
}

/** A task outcome as the reader should see it. */
export function useTaskOutcome(): (outcome: string) => string {
  const t = useTranslations();
  return (outcome) => translateOutcome(outcome, (key) => t(key as never));
}
