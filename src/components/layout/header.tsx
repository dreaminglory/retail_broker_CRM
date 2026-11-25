"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { CommandPalette } from "@/components/domain/search/command-palette";
import { findNavItem } from "./nav-config";
import type { ShellUser } from "./shell-types";
import { MobileSidebar } from "./sidebar";

type HeaderProps = {
  user: ShellUser;
  agencyName: string;
};

/**
 * Bright header: breadcrumb (group › page) on the left, search on the right.
 * The profile menu lives in the sidebar's user block; no bell, no "+ Ново"
 * (spec ui-bright: left out, logged in SPEC.md).
 */
export function Header({ user, agencyName }: HeaderProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const found = findNavItem(pathname);
  const onSubPage = found !== null && pathname !== found.item.href;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <MobileSidebar user={user} agencyName={agencyName} />

      <nav aria-label={t("breadcrumb")} className="min-w-0 flex-1">
        {found && (
          <ol className="flex min-w-0 items-center gap-2 text-body">
            <li className="hidden shrink-0 text-muted-foreground sm:block">{t(`groups.${found.group.key}`)}</li>
            <li aria-hidden className="hidden text-muted-foreground sm:block">
              <ChevronRight className="size-4" />
            </li>
            <li className="min-w-0 truncate">
              {onSubPage ? (
                <Link href={found.item.href} className="text-muted-foreground underline-offset-4 hover:text-ink hover:underline">
                  {t(found.item.key)}
                </Link>
              ) : (
                <span aria-current="page" className="font-semibold text-ink">
                  {t(found.item.key)}
                </span>
              )}
            </li>
          </ol>
        )}
      </nav>

      <div className="hidden shrink-0 md:flex">
        <CommandPalette />
      </div>
    </header>
  );
}
