import {
  Briefcase,
  CalendarCheck,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldAlert,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import { MANAGER_ROLES, hasRole, type MemberRole } from "@/lib/roles";

/** Keys under `nav` in messages/*.json. */
export type NavItemKey =
  | "today"
  | "inquiries"
  | "opportunities"
  | "lists"
  | "contacts"
  | "properties"
  | "dashboard"
  | "reports"
  | "exceptions"
  | "settings";

/** Keys under `nav.groups` in messages/*.json. */
export type NavGroupKey = "myDay" | "work" | "base" | "agency";

export type NavItem = {
  key: NavItemKey;
  href: string;
  icon: LucideIcon;
  /** Roles that see the item; every role when absent. */
  roles?: readonly MemberRole[];
  /** A placeholder screen: the sidebar adds the Скоро badge (spec ui-bright, phase 4). */
  comingSoon?: boolean;
};

export type NavGroup = {
  key: NavGroupKey;
  items: NavItem[];
};

/** The sidebar, grouped as in the Bright screens (spec ui-bright, phase 1). */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "myDay",
    items: [
      { key: "today", href: "/today", icon: CalendarCheck },
      { key: "inquiries", href: "/inquiries", icon: Inbox },
    ],
  },
  {
    key: "work",
    items: [
      { key: "opportunities", href: "/opportunities", icon: Briefcase },
      { key: "lists", href: "/lists", icon: ListChecks },
    ],
  },
  {
    key: "base",
    items: [
      { key: "contacts", href: "/contacts", icon: Users },
      { key: "properties", href: "/properties", icon: Home },
    ],
  },
  {
    key: "agency",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "reports", href: "/reports", icon: Trophy, comingSoon: true },
      { key: "exceptions", href: "/exceptions", icon: ShieldAlert, roles: MANAGER_ROLES },
      { key: "settings", href: "/settings", icon: Settings },
    ],
  },
];

/** The groups and items `role` may see; a group with nothing left is dropped. */
export function visibleNavGroups(role: string | null | undefined): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || hasRole(role, item.roles)),
  })).filter((group) => group.items.length > 0);
}

/** An item is active on its own path and below it (`/opportunities/123`). */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The group and item a path belongs to, for the header breadcrumb. */
export function findNavItem(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => isNavItemActive(candidate.href, pathname));
    if (item) return { group, item };
  }
  return null;
}
