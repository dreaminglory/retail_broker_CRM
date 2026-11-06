import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pageInfo } from "@/lib/pagination";
import type { MatchPage } from "@/domain/matching/types";
import { hrefWith, type MatchParamKeys, type MatchView } from "./match-params";

/** Rows shown before "Show all". */
export const MATCH_PREVIEW_SIZE = 10;

type ControlsProps = {
  view: MatchView;
  keys: MatchParamKeys;
  baseParams: Record<string, string>;
  /** The id of the section the links land on. */
  anchor: string;
};

const linkClass = buttonVariants({ variant: "ghost", size: "sm" });

/** "Show already offered" / "Hide already offered", in the section header. */
export function LinkedToggle({ view, keys, baseParams, anchor }: ControlsProps) {
  const t = useTranslations("matching");
  return (
    <Link
      href={hrefWith(baseParams, { [keys.linked]: view.linked ? null : "1", [keys.page]: null }, anchor)}
      className={linkClass}
      scroll={false}
    >
      {t(view.linked ? "hideLinked" : "showLinked")}
    </Link>
  );
}

/** "Show all (n)" under the preview, or the pager of 20 once all are shown. */
export function MatchListFooter({ view, keys, baseParams, anchor, matches }: ControlsProps & { matches: MatchPage<unknown> }) {
  const t = useTranslations("matching");
  const format = useFormatter();

  if (!view.all) {
    if (matches.total <= MATCH_PREVIEW_SIZE) return null;
    return (
      <div className="border-t px-5 py-2">
        <Link href={hrefWith(baseParams, { [keys.all]: "all", [keys.page]: null }, anchor)} className={linkClass} scroll={false}>
          {t("showAll", { count: format.number(matches.total) })}
        </Link>
      </div>
    );
  }

  const pager = pageInfo(matches.page, matches.pageSize, matches.total);
  const hasPrev = pager.page > 1;
  const hasNext = pager.page < pager.totalPages;
  const disabled = "pointer-events-none opacity-50";

  return (
    <nav aria-label={t("pagerLabel")} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-2">
      <div className="flex items-center gap-3">
        <Link href={hrefWith(baseParams, { [keys.all]: null, [keys.page]: null }, anchor)} className={linkClass} scroll={false}>
          {t("showFewer")}
        </Link>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("range", { from: format.number(pager.from), to: format.number(pager.to), total: format.number(pager.total) })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={hrefWith(baseParams, { [keys.all]: "all", [keys.page]: pager.page - 1 <= 1 ? null : String(pager.page - 1) }, anchor)}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), !hasPrev && disabled)}
          scroll={false}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("prev")}
        </Link>
        <span className="text-sm text-muted-foreground">{t("pageOf", { page: pager.page, pages: pager.totalPages })}</span>
        <Link
          href={hrefWith(baseParams, { [keys.all]: "all", [keys.page]: String(pager.page + 1) }, anchor)}
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), !hasNext && disabled)}
          scroll={false}
        >
          {t("next")}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
    </nav>
  );
}
