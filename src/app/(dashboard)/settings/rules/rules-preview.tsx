import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ComingSoonControl, ComingSoonSection } from "@/components/layout/coming-soon";

// Sample rules for the Скоро placeholder (spec ui-bright, phase 4): texts from message keys,
// nothing read from the database, every control disabled.
const RULES = [
  { key: "r1", threshold: 3, unit: "days", severity: "critical", on: true },
  { key: "r2", threshold: 2, unit: "hours", severity: "critical", on: true },
  { key: "r3", threshold: 3, unit: "days", severity: "attention", on: true },
  { key: "r4", threshold: 1, unit: "days", severity: "attention", on: true },
  { key: "r5", threshold: 15, unit: "minutes", severity: "critical", on: true },
  { key: "r6", threshold: 2, unit: "days", severity: "info", on: false },
] as const;

const SEVERITY_VARIANT = { critical: "overdue", attention: "at-risk", info: "default" } as const;

export function RulesPreview() {
  const t = useTranslations("SettingsRules");

  return (
    <div>
      <h1 className="text-title text-ink">{t("title")}</h1>
      <p className="mt-1 mb-4 text-body text-muted-foreground">{t("description")}</p>

      <ComingSoonSection>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {RULES.map((rule) => {
            const title = t(`items.${rule.key}.title`);
            return (
              <li key={rule.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <Switch disabled defaultChecked={rule.on} aria-label={`${t("enabled")}: ${title}`} />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-body-strong text-ink">{title}</p>
                  <p className="text-small text-muted-foreground">{t(`items.${rule.key}.desc`)}</p>
                  <p className="mt-1 text-small text-muted-foreground">{t(`items.${rule.key}.owner`)}</p>
                </div>
                <div className="flex items-center gap-2 text-small text-muted-foreground">
                  <span>{t("after")}</span>
                  <Input
                    disabled
                    readOnly
                    defaultValue={rule.threshold}
                    aria-label={`${t("threshold")}: ${title}`}
                    className="w-16 text-right tabular-nums"
                  />
                  <span>{t(`units.${rule.unit}`)}</span>
                </div>
                <Badge variant={SEVERITY_VARIANT[rule.severity]} className="h-6 min-w-24">
                  {t(`severity.${rule.severity}`)}
                </Badge>
              </li>
            );
          })}
          <li className="p-4">
            <ComingSoonControl variant="outline" className="border-dashed">
              {t("newRule")}
            </ComingSoonControl>
          </li>
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          <ComingSoonControl variant="outline">{t("cancel")}</ComingSoonControl>
          <ComingSoonControl>{t("save")}</ComingSoonControl>
        </div>
      </ComingSoonSection>
    </div>
  );
}
