"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Users, Radio, Settings as SettingsIcon, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

interface SettingsSidebarProps {
  userRole: string;
}

export function SettingsSidebar({ userRole }: SettingsSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("settings");

  const sidebarNavItems = [
    {
      i18nKey: "profile",
      href: "/settings/profile",
      icon: User,
    },
    {
      i18nKey: "team",
      href: "/settings/team",
      icon: Users,
    },
    {
      i18nKey: "leadSources",
      href: "/settings/lead-sources",
      icon: Radio,
    },
    {
      i18nKey: "pipelineStages",
      href: "/settings/stages",
      icon: SettingsIcon,
    },
  ];

  if (userRole === "owner" || userRole === "manager") {
    sidebarNavItems.push({
      i18nKey: "import",
      href: "/settings/import",
      icon: Upload,
    });
  }

  return (
    <aside className="w-full md:w-64 shrink-0">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>
      <nav className="flex space-x-2 md:flex-col md:space-x-0 md:space-y-1 overflow-x-auto pb-4 md:pb-0">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground whitespace-nowrap",
            pathname === "/settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
          )}
        >
          <SettingsIcon className="h-4 w-4" />
          {t("overview")}
        </Link>
        {sidebarNavItems.map((item) => {
          const label = t(item.i18nKey as any);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground whitespace-nowrap",
                pathname.startsWith(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
