"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Users, Radio, Settings as SettingsIcon, Upload, MapPin, ShieldAlert, Link2 } from "lucide-react";
import { ComingSoonBadge } from "@/components/layout/coming-soon";
import { useTranslations } from "next-intl";
import { CONFIG_ROLES, hasRole } from "@/lib/roles";

interface SettingsSidebarProps {
  userRole: string;
}

/** Sub-nav link: the active page is tinted and semibold (settings-*.png). */
function navLink(active: boolean) {
  return cn(
    "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-body transition-colors hover:bg-accent",
    active ? "bg-accent font-semibold text-primary" : "text-ink"
  );
}

export function SettingsSidebar({ userRole }: SettingsSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("settings");

  type NavItem = {
    i18nKey: "profile" | "team" | "leadSources" | "pipelineStages" | "areas" | "import" | "rules" | "portals";
    href: string;
    icon: typeof User;
    /** A Скоро placeholder (spec ui-bright, phase 4). */
    comingSoon?: boolean;
  };
  type NavGroup = { key: "personal" | "agency" | "work" | "data"; items: NavItem[] };

  const groups: NavGroup[] = [
    { key: "personal", items: [{ i18nKey: "profile", href: "/settings/profile", icon: User }] },
    { key: "agency", items: [{ i18nKey: "team", href: "/settings/team", icon: Users }] },
  ];

  // Configuration pages are owner/manager only (AD-045).
  if (hasRole(userRole, CONFIG_ROLES)) {
    groups.push(
      {
        key: "work",
        items: [
          { i18nKey: "leadSources", href: "/settings/lead-sources", icon: Radio },
          { i18nKey: "pipelineStages", href: "/settings/stages", icon: SettingsIcon },
          { i18nKey: "areas", href: "/settings/areas", icon: MapPin },
          { i18nKey: "rules", href: "/settings/rules", icon: ShieldAlert, comingSoon: true },
        ],
      },
      {
        key: "data",
        items: [
          { i18nKey: "import", href: "/settings/import", icon: Upload },
          { i18nKey: "portals", href: "/settings/portals", icon: Link2, comingSoon: true },
        ],
      },
    );
  }

  return (
    <aside className="w-full shrink-0 md:w-60">
      <div className="mb-6">
        <h2 className="text-title text-ink">{t("title")}</h2>
        <p className="mt-1 text-body text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-4 md:flex-col md:pb-0">
        <Link href="/settings" className={navLink(pathname === "/settings")}>
          <SettingsIcon className="size-4" aria-hidden />
          {t("overview")}
        </Link>
        {groups.map((group) => (
          <div key={group.key} className="flex gap-1 md:flex-col">
            <p className="hidden px-3 pb-1 pt-4 text-label uppercase text-muted-foreground md:block">
              {t(`groups.${group.key}`)}
            </p>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className={navLink(pathname.startsWith(item.href))}>
                <item.icon className="size-4 shrink-0" aria-hidden />
                {t(item.i18nKey)}
                {item.comingSoon && <ComingSoonBadge className="ml-auto" />}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
