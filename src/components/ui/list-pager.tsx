"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pageInfo } from "@/lib/pagination";

type ListPagerProps = {
  page: number;
  pageSize: number;
  total: number;
};

/** Prev/next pager for server-paged lists; keeps the other query params and sets `?page=`. */
export function ListPager({ page, pageSize, total }: ListPagerProps) {
  const t = useTranslations("ListPager");
  const format = useFormatter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const info = pageInfo(page, pageSize, total);

  if (total === 0) return null;

  function hrefFor(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const disabledClass = "pointer-events-none opacity-50";
  const hasPrev = info.page > 1;
  const hasNext = info.page < info.totalPages;

  return (
    <nav
      aria-label={t("label")}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("range", {
          from: format.number(info.from),
          to: format.number(info.to),
          total: format.number(info.total),
        })}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={hrefFor(info.page - 1)}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), !hasPrev && disabledClass)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("prev")}
        </Link>
        <span className="text-sm text-muted-foreground">
          {t("pageOf", { page: info.page, pages: info.totalPages })}
        </span>
        <Link
          href={hrefFor(info.page + 1)}
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), !hasNext && disabledClass)}
        >
          {t("next")}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
    </nav>
  );
}
