"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  CalendarCheck,
  Users,
  Briefcase,
  Inbox,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface NavItem {
  i18nKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
  roles?: string[]; // Allowed roles to see this item
}

const navItems: NavItem[] = [
  {
    i18nKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    i18nKey: "today",
    href: "/today",
    icon: CalendarCheck,
  },
  {
    i18nKey: "contacts",
    href: "/contacts",
    icon: Users,
  },
  {
    i18nKey: "opportunities",
    href: "/opportunities",
    icon: Briefcase,
  },
  {
    i18nKey: "inquiries",
    href: "/inquiries",
    icon: Inbox,
  },
  {
    i18nKey: "settings",
    href: "/settings",
    icon: Settings,
  },
  {
    i18nKey: "exceptions",
    href: "/exceptions",
    icon: ShieldAlert,
    roles: ["owner", "manager"],
  },
];

interface SidebarProps {
  userRole?: string;
}

export function Sidebar({ userRole = "broker" }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("nav");

  return (
    <aside
      className={cn(
        "hidden md:flex h-full flex-col border-r bg-sidebar-background transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Building2 className="h-6 w-6 shrink-0 text-sidebar-primary" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
            BrokerCRM
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          if (item.roles && !item.roles.includes(userRole)) {
            return null;
          }

          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-40 cursor-not-allowed",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? `${t(item.i18nKey as any)} (${item.badge})` : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{t(item.i18nKey as any)}</span>
                    {item.badge && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? t(item.i18nKey as any) : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t(item.i18nKey as any)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

export function MobileSidebar({ userRole = "broker" }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden flex items-center justify-center rounded-md p-2 hover:bg-accent text-foreground">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SheetDescription className="sr-only">Access different sections of BrokerCRM.</SheetDescription>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Building2 className="h-6 w-6 shrink-0 text-sidebar-primary" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
            BrokerCRM
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            if (item.roles && !item.roles.includes(userRole)) return null;
            const isActive =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-40 cursor-not-allowed"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{t(item.i18nKey as any)}</span>
                  {item.badge && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(item.i18nKey as any)}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
