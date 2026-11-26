import Link from "next/link";
import { useTranslations } from "next-intl";
import { Briefcase, ChevronRight, Inbox, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListOverview } from "@/domain/smart-lists/service";
import type { SmartListEntity } from "@/domain/smart-lists/types";
import { formatListCount, listHref } from "./list-links";
import { ScopeToggle } from "./scope-toggle";

function EntityIcon({ entity }: { entity: SmartListEntity }) {
  const t = useTranslations("smartLists.entity");
  const Icon = entity === "opportunity" ? Briefcase : Inbox;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
      <Icon className="size-[18px]" aria-label={t(entity)} />
    </span>
  );
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
        className="flex h-full min-h-28 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex items-start gap-3">
          <EntityIcon entity={entity} />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-body-strong text-ink">{name}</span>
            {detail && <span className="block truncate text-small text-muted-foreground">{detail}</span>}
          </span>
          <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </span>
        <span className="mt-auto tabular-nums">{count}</span>
      </Link>
    </li>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className={cn(
        "text-num-lg font-semibold",
        count > 0 ? "text-ink" : "text-muted-foreground"
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
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">{t("overview.title")}</h1>
          <p className="mt-1 text-body text-muted-foreground">{t("overview.description")}</p>
        </div>
        {canSwitchScope && <ScopeToggle scope={scope} basePath="/lists" />}
      </div>

      <section aria-labelledby="lists-built-in" className="mb-8">
        <h2 id="lists-built-in" className="mb-3 text-label uppercase text-muted-foreground">
          {t("overview.builtIn")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <h2 id="lists-saved" className="mb-3 text-label uppercase text-muted-foreground">
          {t("overview.saved")}
        </h2>
        {saved.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
            {t("overview.savedEmpty")}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
