import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ComingSoonControl, ComingSoonSection } from "@/components/layout/coming-soon";
import { initials } from "@/lib/initials";

type Option = "publish" | "price" | "inquiries" | "showAll";

type Portal = {
  key: "imot" | "homes" | "site" | "olx";
  status: "connected" | "hasErrors" | "notConnected";
  /** The line under the name. */
  line: { kind: "synced"; listings: number; time: string } | { kind: "site" } | { kind: "none" };
  options: readonly (readonly [Option, boolean])[];
  rejected: boolean;
};

// Sample portals for the Скоро placeholder (spec ui-bright, phase 4): names and labels from
// message keys, nothing read from the database, every control disabled.
const PORTALS: readonly Portal[] = [
  {
    key: "imot",
    status: "connected",
    line: { kind: "synced", listings: 87, time: "10:42" },
    options: [["publish", true], ["price", true], ["inquiries", true]],
    rejected: false,
  },
  {
    key: "homes",
    status: "hasErrors",
    line: { kind: "synced", listings: 81, time: "10:40" },
    options: [["publish", true], ["price", false], ["inquiries", true]],
    rejected: true,
  },
  { key: "site", status: "connected", line: { kind: "site" }, options: [["showAll", true], ["inquiries", true]], rejected: false },
  { key: "olx", status: "notConnected", line: { kind: "none" }, options: [], rejected: false },
];

const STATUS_VARIANT = { connected: "default", hasErrors: "secondary", notConnected: "outline" } as const;

export function PortalsPreview() {
  const t = useTranslations("SettingsPortals");

  function lineText(line: Portal["line"]): string {
    switch (line.kind) {
      case "synced":
        return t("listings", { count: line.listings, when: t("today", { time: line.time }) });
      case "site":
        return t("items.site.line");
      case "none":
        return t("notConnectedLine");
    }
  }

  return (
    <div>
      <h1 className="text-title text-ink">{t("title")}</h1>
      <p className="mt-1 mb-4 text-body text-muted-foreground">{t("description")}</p>

      <ComingSoonSection>
        <ul className="grid gap-4 lg:grid-cols-2">
          {PORTALS.map((portal) => {
            const name = t(`items.${portal.key}.name`);
            return (
              <li key={portal.key} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-info-soft text-body-strong text-primary">
                    {initials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-strong text-ink">{name}</p>
                    <p className="text-small text-muted-foreground tabular-nums">{lineText(portal.line)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[portal.status]}>{t(portal.status)}</Badge>
                </div>

                {portal.options.map(([option, on]) => (
                  <div key={option} className="flex items-center justify-between gap-3 text-body text-ink">
                    <span>{t(`options.${option}`)}</span>
                    <Switch disabled defaultChecked={on} aria-label={`${name}: ${t(`options.${option}`)}`} />
                  </div>
                ))}

                {portal.rejected && (
                  <p className="rounded-md bg-at-risk-soft px-3 py-2 text-small text-at-risk-ink">{t("rejected")}</p>
                )}

                <div className="mt-auto pt-1">
                  {portal.status === "notConnected" ? (
                    <ComingSoonControl>{t("connect")}</ComingSoonControl>
                  ) : (
                    <ComingSoonControl variant="outline">{t("syncNow")}</ComingSoonControl>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          <ComingSoonControl variant="outline">{t("cancel")}</ComingSoonControl>
          <ComingSoonControl>{t("save")}</ComingSoonControl>
        </div>
      </ComingSoonSection>
    </div>
  );
}
