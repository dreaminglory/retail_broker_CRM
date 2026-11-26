"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CommandPalette, SearchDialog, SearchTrigger } from "@/components/domain/search/command-palette";
import { isNavItemActive, visibleNavGroups } from "./nav-config";
import type { ShellUser } from "./shell-types";
import { UserMenu, initials } from "./user-menu";

type SidebarProps = {
  user: ShellUser;
  agencyName: string;
};

/** The agency's mark: its initials on primary, as in the Bright sidebar. */
function AgencyMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-body-strong text-primary-foreground"
    >
      {initials(name)}
    </span>
  );
}

function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav aria-label={t("menuTitle")} className="flex-1 overflow-y-auto px-3 pb-3">
      {visibleNavGroups(role).map((group) => (
        <div
          key={group.key}
          className={cn(collapsed ? "border-t border-border py-2 first:border-t-0" : "pt-4 first:pt-2")}
        >
          {!collapsed && (
            <p id={`nav-group-${group.key}`} className="px-3 pb-1 text-label text-muted-foreground uppercase">
              {t(`groups.${group.key}`)}
            </p>
          )}
          <ul
            className="space-y-0.5"
            aria-labelledby={collapsed ? undefined : `nav-group-${group.key}`}
            aria-label={collapsed ? t(`groups.${group.key}`) : undefined}
          >
            {group.items.map((item) => {
              const active = isNavItemActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? t(item.key) : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-md px-3 text-body text-ink outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                      active && "bg-accent font-semibold hover:bg-accent",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    {collapsed ? <span className="sr-only">{t(item.key)}</span> : <span className="truncate">{t(item.key)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ user, agencyName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("nav");

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-3 p-3", collapsed && "flex-col")}>
        <AgencyMark name={agencyName} />
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-body-strong text-ink">{agencyName}</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          aria-expanded={!collapsed}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <div className={cn("px-3 pb-1", collapsed && "flex justify-center")}>
        <CommandPalette collapsed={collapsed} />
      </div>

      <SidebarNav role={user.role} collapsed={collapsed} />

      <div className="border-t border-border p-3">
        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}

export function MobileSidebar({ user, agencyName }: SidebarProps) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="flex size-9 items-center justify-center rounded-md text-ink outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-focus md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">{t("toggleMenu")}</span>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">{t("menuTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("menuDescription")}</SheetDescription>
          <div className="flex items-center gap-3 p-3 pr-12">
            <AgencyMark name={agencyName} />
            <span className="min-w-0 flex-1 truncate text-body-strong text-ink">{agencyName}</span>
          </div>
          <div className="px-3 pb-1">
            <SearchTrigger
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
            />
          </div>
          <SidebarNav role={user.role} onNavigate={() => setOpen(false)} />
          <div className="border-t border-border p-3">
            <UserMenu user={user} />
          </div>
        </SheetContent>
      </Sheet>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
