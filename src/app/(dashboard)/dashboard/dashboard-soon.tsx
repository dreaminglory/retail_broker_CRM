import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ComingSoonSection } from "@/components/layout/coming-soon";
import { initials } from "@/lib/initials";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Sample figures for the Скоро section of Табло (spec ui-bright, phase 4, dashboard.png).
// Labels come from message keys, numbers are formatted per locale; nothing is queried, and there
// is no control: the section is read-only. Charts are plain CSS bars (no chart library).
const COMMISSIONS = [39, 43, 30, 44, 52, 49, 56, 46, 51, 58, 55, 61]; // thousand €, Dec … Nov
const FUNNEL = [
  { key: "inquiries", value: 148 },
  { key: "viewings", value: 89 },
  { key: "offers", value: 27 },
  { key: "deposit", value: 12 },
  { key: "deals", value: 9 },
] as const;
const SOURCES = [
  { key: "imot", value: 62 },
  { key: "homes", value: 31 },
  { key: "site", value: 24 },
  { key: "referrals", value: 17 },
  { key: "facebook", value: 9 },
  { key: "phone", value: 5 },
] as const;
const HEALTH = [
  { key: "stale", count: 9, tone: "bg-due-soft text-due-ink" },
  { key: "noPhotos", count: 11, tone: "bg-due-soft text-due-ink" },
  { key: "slow", count: 14, tone: "bg-due-soft text-due-ink" },
  { key: "noOwner", count: 17, tone: "bg-overdue-soft text-overdue" },
] as const;
const TEAM = [
  { key: "b1", status: "free", tasks: 7 },
  { key: "b2", status: "free", tasks: 5 },
  { key: "b3", status: "viewing", until: "11:30" },
  { key: "b4", status: "free", tasks: 6 },
  { key: "b5", status: "busy", tasks: 4 },
] as const;

const MAX_COMMISSION = Math.max(...COMMISSIONS);

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="text-section text-ink">{title}</h3>
        {note && <p className="text-small text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Bar({ label, amount, max, display, percent }: { label: string; amount: number; max: number; display: string; percent?: string }) {
  const width = `${Math.max(2, (amount / max) * 100)}%`;
  return (
    <li className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-small tabular-nums">
      <span className="truncate text-ink">{label}</span>
      <span aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width }} />
      </span>
      <span className="text-right text-ink">
        {display}
        {percent && <span className="ml-1.5 text-muted-foreground">{percent}</span>}
      </span>
    </li>
  );
}

export function DashboardSoon() {
  const t = useTranslations("DashboardSoon");
  const format = useFormatter();
  const total = SOURCES.reduce((sum, source) => sum + source.value, 0);

  return (
    <section aria-labelledby="dashboard-soon" className="mt-8">
      <h2 id="dashboard-soon" className="mb-3 text-section text-ink">{t("title")}</h2>
      <ComingSoonSection>
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Block id="soon-commissions" title={t("commissions.title")} note={t("commissions.note")}>
            <ol className="flex h-44 items-end gap-2" aria-label={t("commissions.title")}>
              {COMMISSIONS.map((value, index) => {
                const month = format.dateTime(new Date(2025, 11 + index, 1), { month: "short" });
                const latest = index === COMMISSIONS.length - 1;
                const amount = format.number(value * 1000, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
                return (
                  <li key={index} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span
                      className={latest ? "w-full rounded-t-sm bg-ink" : "w-full rounded-t-sm bg-primary"}
                      style={{ height: `${(value / MAX_COMMISSION) * 100}%` }}
                      title={amount}
                    />
                    <span className="truncate text-label text-muted-foreground">
                      {month}
                      <span className="sr-only">: {amount}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Block>

          <Block id="soon-funnel" title={t("funnel.title")}>
            <ul className="space-y-3">
              {FUNNEL.map((step) => (
                <Bar key={step.key} label={t(`funnel.steps.${step.key}`)} amount={step.value} display={format.number(step.value)} max={FUNNEL[0].value} />
              ))}
            </ul>
            <p className="mt-4 text-small text-muted-foreground tabular-nums">
              {t("funnel.conversion")}:{" "}
              <strong className="text-ink">{format.number(FUNNEL[4].value / FUNNEL[0].value, { style: "percent", maximumFractionDigits: 1 })}</strong>
            </p>
          </Block>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Block id="soon-sources" title={t("sources.title")}>
            <ul className="space-y-3">
              {SOURCES.map((source) => (
                <Bar
                  key={source.key}
                  label={t(`sources.items.${source.key}`)}
                  amount={source.value}
                  display={format.number(source.value)}
                  max={SOURCES[0].value}
                  percent={format.number(source.value / total, { style: "percent" })}
                />
              ))}
            </ul>
          </Block>

          <Block id="soon-health" title={t("health.title")}>
            <ul className="divide-y divide-border">
              {HEALTH.map((item) => (
                <li key={item.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-body-strong text-ink">{t(`health.items.${item.key}.title`)}</p>
                    <p className="text-small text-muted-foreground">{t(`health.items.${item.key}.note`)}</p>
                  </div>
                  <Badge variant="secondary" className={cn("h-6 min-w-8 text-body-strong tabular-nums", item.tone)}>
                    {format.number(item.count)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="soon-team" title={t("team.title")} note={t("team.free", { count: TEAM.filter((m) => m.status === "free").length })}>
            <ul className="divide-y divide-border">
              {TEAM.map((member) => {
                const name = t(`team.members.${member.key}`);
                return (
                  <li key={member.key} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <Avatar aria-hidden>
                      <AvatarFallback>{initials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-strong text-ink">{name}</p>
                      <p className="text-small text-muted-foreground">{t(`team.status.${member.status}`)}</p>
                    </div>
                    <span className="text-small text-muted-foreground tabular-nums">
                      {"until" in member ? t("team.until", { time: member.until }) : t("team.tasks", { count: member.tasks })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Block>
        </div>
      </ComingSoonSection>
    </section>
  );
}
