import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ComingSoonControl, ComingSoonSection } from "@/components/layout/coming-soon";
import { initials } from "@/lib/initials";

type Option = "publish" | "price" | "inquiries" | "showAll";

// Sample portals for the Скоро placeholder (spec ui-bright, phase 4): names and labels from
// message keys, nothing read from the database, every control disabled.
const PORTALS = [
  { key: "imot", status: "connected", listings: 87, time: "10:42", options: { publish: true, price: true, inquiries: true } },
  { key: "homes", status: "hasErrors", listings: 81, time: "10:40", options: { publish: true, price: false, inquiries: true }, rejected: true },
  { key: "site", status: "connected", options: { showAll: true, inquiries: true } },
  { key: "olx", status: "notConnected" },
] as const satisfies readonly {
  key: string;
  status: "connected" | "hasErrors" | "notConnected";
  listings?: number;
  time?: string;
  options?: Partial<Record<Option, boolean>>;
  rejected?: boolean;
}[];

const STATUS_VARIANT = { connected: "default", hasErrors: "secondary", notConnected: "outline" } as const;

export function PortalsPreview() {
  const t = useTranslations("SettingsPortals");

  return (
    <div>
      <h1 className="text-title text-ink">{t("title")}</h1>
      <p className="mt-1 mb-4 text-body text-muted-foreground">{t("description")}</p>

      <ComingSoonSection>
        <ul className="grid gap-4 lg:grid-cols-2">
          {PORTALS.map((portal) => {
            const name = t(`items.${portal.key}.name`);
            const options = "options" in portal ? (Object.entries(portal.options) as [Option, boolean][]) : [];
            const hasListings = "listings" in portal;
            const connected = portal.status !== "notConnected";
            return (
              <li key={portal.key} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-info-soft text-body-strong text-primary">
                    {initials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-strong text-ink">{name}</p>
                    <p className="text-small text-muted-foreground tabular-nums">
                      {hasListings
                        ? t("listings", { count: portal.listings, when: t("today", { time: portal.time }) })
                        : portal.key === "site"
                          ? t("items.site.line")
                          : t("notConnectedLine")}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[portal.status]}>{t(portal.status)}</Badge>
                </div>

                {options.map(([option, on]) => (
                  <div key={option} className="flex items-center justify-between gap-3 text-body text-ink">
                    <span>{t(`options.${option}`)}</span>
                    <Switch disabled defaultChecked={on} aria-label={`${name}: ${t(`options.${option}`)}`} />
                  </div>
                ))}

                {"rejected" in portal && (
                  <p className="rounded-md bg-at-risk-soft px-3 py-2 text-small text-at-risk-ink">{t("rejected")}</p>
                )}

                <div className="mt-auto pt-1">
                  {connected ? (
                    <ComingSoonControl variant="outline">{t("syncNow")}</ComingSoonControl>
                  ) : (
                    <ComingSoonControl>{t("connect")}</ComingSoonControl>
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
