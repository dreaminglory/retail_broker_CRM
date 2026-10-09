"use client";

import { useTranslations } from "next-intl";

export function useStageTranslation() {
  const enums = useTranslations("Enums");

  return function getStageName(name: string | undefined | null) {
    if (!name) return "";
    const key = `Stages.${name}` as any;
    if (enums.has(key)) {
      return enums(key);
    }
    return name;
  };
}
