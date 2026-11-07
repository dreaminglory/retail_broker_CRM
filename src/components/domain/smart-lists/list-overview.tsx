import Link from "next/link";
import { useTranslations } from "next-intl";
import { Briefcase, ChevronRight, Inbox, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListOverview } from "@/domain/smart-lists/service";
import type { SmartListEntity } from "@/domain/smart-lists/types";
import { formatListCount, listHref } from "./list-count";

function EntityIcon({ entity }: { entity: SmartListEntity }) {
  const t = useTranslations("smartLists.entity");
  const Icon = entity === "opportunity" ? Briefcase : Inbox;
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={t(entity)} />;
}

function ListRow({
  href,
  entity,
  name,
  detail,
  count,
}: {
  href: string;
  entity: SmartListEntity;
  name: string;
  detail?: React.ReactNode;
  count: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <EntityIcon entity={entity} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
        <span className="shrink-0 tabular-nums">{count}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-8 justify-center rounded-full px-2 py-0.5 text-sm font-semibold",
        count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}
    >
      {formatListCount(count)}
    </span>
  );
}

/** The Списъци overview: built-in and saved lists with their live counts (spec: Screens). */
export function ListOverviewView({ scope, canSwitchScope, builtIn, saved }: ListOverview) {
  const t = useTranslations("smartLists");
  const tRoot = useTranslations();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("overview.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("overview.description")}</p>
        </div>
        {canSwitchScope && (
          <div role="group" aria-label={t("scope.label")} className="inline-flex rounded-md border p-0.5 text-sm">
            {(["mine", "agency"] as const).map((option) => (
              <Link
                key={option}
                href={option === "agency" ? "/lists?scope=agency" : "/lists"}
                aria-current={scope === option ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1 transition-colors",
                  scope === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`scope.${option}`)}
              </Link>
            ))}
          </div>
        )}
      </div>

      <section aria-labelledby="lists-built-in" className="mb-8">
        <h2 id="lists-built-in" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("overview.builtIn")}
        </h2>
        <ul className="divide-y rounded-lg border bg-card">
          {builtIn.map(({ list, count }) => (
            <ListRow
              key={list.id}
              href={listHref(list.id, scope)}
              entity={list.entity}
              name={tRoot(list.nameKey as never)}
              detail={list.scope === "agency-only" ? t("overview.agencyWide") : undefined}
              count={<CountBadge count={count} />}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="lists-saved">
        <h2 id="lists-saved" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("overview.saved")}
        </h2>
        {saved.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t("overview.savedEmpty")}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {saved.map(({ list, count, sharedBy }) => (
              <ListRow
                key={list.id}
                href={`/lists/${list.id}`}
                entity={list.entity}
                name={list.name}
                detail={
                  count === null ? (
                    t("overview.stale")
                  ) : list.shared ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" aria-hidden />
                      {sharedBy ? t("overview.sharedBy", { name: sharedBy }) : t("overview.shared")}
                    </span>
                  ) : undefined
                }
                count={count === null ? <span className="text-sm text-muted-foreground">—</span> : <CountBadge count={count} />}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
