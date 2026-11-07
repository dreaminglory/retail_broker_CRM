import Link from "next/link";
import type { ComponentProps } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, SkipForward, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { queueStepHref } from "@/domain/smart-lists/queue";
import type { ListScope, SortKey } from "@/domain/smart-lists/types";

type QueueBarProps = {
  listId: string;
  listName: string;
  pos: number;
  total: number;
  /** The key this deal came with; null when the link lost it (Next then starts over). */
  sortKey: SortKey | null;
  scope: ListScope;
};

/**
 * A link to a queue step. Never prefetched: a step re-runs the list, and a prefetched redirect
 * would land on the deal the list pointed at when the link was rendered, not at the click.
 */
export function QueueStepLink(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  return <Link {...props} prefetch={false} />;
}

/**
 * Work through: the bar on a deal opened from a list (spec rule 7). Links only, so the step runs
 * on the server at the moment of the click; sticky at the bottom of the page.
 */
export function QueueBar({ listId, listName, pos, total, sortKey, scope }: QueueBarProps) {
  const t = useTranslations("smartLists.queue");
  const format = useFormatter();
  const listHref = scope === "agency" ? `/lists/${listId}?scope=agency` : `/lists/${listId}`;
  const nextHref = queueStepHref({ listId, dir: "next", pos, after: sortKey, scope });
  const prevHref = queueStepHref({ listId, dir: "prev", pos, scope });
  const disabled = "pointer-events-none opacity-50";

  return (
    <nav
      aria-label={t("label", { name: listName })}
      className="sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] backdrop-blur md:mx-0 md:rounded-lg md:border"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link href={listHref} className="block truncate text-sm font-semibold hover:underline">
            {listName}
          </Link>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t("position", { pos: format.number(pos), total })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <QueueStepLink
            href={prevHref}
            aria-disabled={pos <= 1}
            tabIndex={pos <= 1 ? -1 : undefined}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), pos <= 1 && disabled)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("previous")}</span>
          </QueueStepLink>
          <QueueStepLink href={nextHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <SkipForward className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("skip")}</span>
          </QueueStepLink>
          <QueueStepLink href={nextHref} className={buttonVariants({ size: "sm" })}>
            {t("next")}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </QueueStepLink>
          <Link href={listHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("exit")}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
