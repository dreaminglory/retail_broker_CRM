import { Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ComingSoonControl, ComingSoonSection } from "@/components/layout/coming-soon";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

// Sample figures for the Скоро placeholder (spec ui-bright, phase 4). Names and labels come from
// message keys; the numbers are formatted per locale. Nothing here is read from the database.
const BROKERS = [
  { key: "b1", commissions: 16800, deals: 2, clients: 11, calls: 164, viewings: 14, response: 22, conversion: 0.062 },
  { key: "b2", commissions: 14200, deals: 2, clients: 19, calls: 212, viewings: 18, response: 4, conversion: 0.079 },
  { key: "b3", commissions: 11900, deals: 2, clients: 14, calls: 241, viewings: 21, response: 12, conversion: 0.068 },
  { key: "b4", commissions: 9600, deals: 1, clients: 16, calls: 188, viewings: 23, response: 9, conversion: 0.051 },
  { key: "b5", commissions: 5200, deals: 1, clients: 9, calls: 132, viewings: 6, response: 31, conversion: 0.044 },
] as const;

const PERIODS = ["month", "quarter", "year"] as const;
const METRICS = ["commissions", "deals", "newClients", "calls", "viewings", "response", "conversion"] as const;
const COLUMNS = ["commissions", "deals", "clients", "calls", "viewings", "response", "conversion"] as const;
const GOAL = { done: 61400, target: 70000 };

/** Listed 1st, 2nd, 3rd so a screen reader reads the ranking in order; `place` puts 1st in the middle. */
const PODIUM = [
  { rank: 1, broker: BROKERS[0], height: "h-40", tone: "bg-highlight", place: "order-2" },
  { rank: 2, broker: BROKERS[1], height: "h-28", tone: "bg-info-soft", place: "order-1" },
  { rank: 3, broker: BROKERS[2], height: "h-20", tone: "bg-muted", place: "order-3" },
] as const;

export function ReportsPreview() {
  const t = useTranslations("Reports");
  const format = useFormatter();
  const eur = (value: number) =>
    format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const topCommission = BROKERS[0].commissions;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display text-ink">{t("title")}</h1>
          <p className="mt-1 text-body text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label={t("periods.label")} className="flex rounded-md border border-border bg-surface p-0.5">
            {PERIODS.map((period) => (
              <ComingSoonControl key={period} variant={period === "month" ? "secondary" : "ghost"} size="sm">
                {t(`periods.${period}`)}
              </ComingSoonControl>
            ))}
          </div>
          <ComingSoonControl variant="outline">
            <Download aria-hidden />
            {t("export")}
          </ComingSoonControl>
        </div>
      </div>

      <ComingSoonSection>
        <div role="group" aria-label={t("metrics.label")} className="mb-4 flex flex-wrap gap-2">
          {METRICS.map((metric) => (
            <ComingSoonControl key={metric} variant={metric === "commissions" ? "default" : "outline"} size="sm" className="rounded-full">
              {t(`metrics.${metric}`)}
            </ComingSoonControl>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section aria-labelledby="reports-podium" className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="reports-podium" className="text-section text-ink">{t("podiumTitle")}</h2>
              <p className="text-small text-muted-foreground">{t("podiumNote")}</p>
            </div>
            <ol className="mt-6 grid grid-cols-3 items-end gap-3">
              {PODIUM.map(({ rank, broker, height, tone, place }) => {
                const name = t(`brokers.${broker.key}`);
                return (
                  <li key={rank} className={cn("flex flex-col items-center gap-1 text-center", place)}>
                    <Avatar size="lg" aria-hidden>
                      <AvatarFallback>{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-small text-muted-foreground">{name}</span>
                    <span className="text-section tabular-nums text-ink sm:text-num-lg">{eur(broker.commissions)}</span>
                    <span className={cn("flex w-full items-start justify-center rounded-t-md border border-b-0 border-border pt-2 text-title text-ink", height, tone)}>
                      {rank}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="reports-goal" className="self-start rounded-lg border border-info-line bg-info-soft p-4">
            <h2 id="reports-goal" className="text-label text-muted-foreground uppercase">{t("goalTitle")}</h2>
            <p className="mt-2 text-section text-ink tabular-nums">
              {eur(GOAL.done)} / {eur(GOAL.target)}
            </p>
            <div
              role="progressbar"
              aria-label={t("goalTitle")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((GOAL.done / GOAL.target) * 100)}
              className="mt-3 h-2 overflow-hidden rounded-full bg-surface"
            >
              <div className="h-full bg-primary" style={{ width: `${(GOAL.done / GOAL.target) * 100}%` }} />
            </div>
            <p className="mt-2 text-small text-muted-foreground tabular-nums">
              {format.number(GOAL.done / GOAL.target, { style: "percent" })} {t("goalLine")}
            </p>
          </section>
        </div>

        <section aria-labelledby="reports-table" className="mt-4 rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
            <h2 id="reports-table" className="text-section text-ink">{t("tableTitle")}</h2>
            <p className="text-small text-muted-foreground">{t("tableNote")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-body">
              <thead>
                <tr className="border-y border-border text-left text-label text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-2 font-semibold">{t("columns.rank")}</th>
                  <th scope="col" className="px-4 py-2 font-semibold">{t("columns.broker")}</th>
                  {COLUMNS.map((col) => (
                    <th key={col} scope="col" className="px-4 py-2 text-right font-semibold">{t(`columns.${col}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {BROKERS.map((broker, index) => {
                  const name = t(`brokers.${broker.key}`);
                  return (
                    <tr key={broker.key} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">{index + 1}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <Avatar size="sm" aria-hidden>
                            <AvatarFallback>{initials(name)}</AvatarFallback>
                          </Avatar>
                          {name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {eur(broker.commissions)}
                        <span aria-hidden className="mt-1 ml-auto block h-1 w-20 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full bg-primary" style={{ width: `${(broker.commissions / topCommission) * 100}%` }} />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{format.number(broker.deals)}</td>
                      <td className="px-4 py-3 text-right">{format.number(broker.clients)}</td>
                      <td className="px-4 py-3 text-right">{format.number(broker.calls)}</td>
                      <td className="px-4 py-3 text-right">{format.number(broker.viewings)}</td>
                      <td className="px-4 py-3 text-right">{format.number(broker.response)}</td>
                      <td className="px-4 py-3 text-right">{format.number(broker.conversion, { style: "percent", maximumFractionDigits: 1 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </ComingSoonSection>
    </div>
  );
}
