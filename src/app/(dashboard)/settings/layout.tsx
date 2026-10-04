"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Users, Radio, Settings as SettingsIcon } from "lucide-react";

const sidebarNavItems = [
  {
    title: "Profile",
    href: "/settings/profile",
    icon: User,
  },
  {
    title: "Team",
    href: "/settings/team",
    icon: Users,
  },
  {
    title: "Lead Sources",
    href: "/settings/lead-sources",
    icon: Radio,
  },
  {
    title: "Pipeline Stages",
    href: "/settings/stages",
    icon: SettingsIcon,
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  // If we are exactly on /settings, we might just want to show the hub without the sidebar,
  // or show the hub INSIDE the sidebar layout. The design says "Settings sub-layout with left sidebar".
  // Let's render the sidebar and the content on the right.

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto w-full">
      <aside className="w-full md:w-64 shrink-0">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and agency preferences.
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
            Overview
          </Link>
          {sidebarNavItems.map((item) => (
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
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
