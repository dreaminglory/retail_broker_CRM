import Link from "next/link";
import { Settings, Radio, ChevronRight, User, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SettingSection {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  available: boolean;
  badge?: string;
}

const settingSections: SettingSection[] = [
  {
    href: "/settings/profile",
    icon: User,
    title: "Profile",
    description:
      "Manage your display name and personal information.",
    available: true,
  },
  {
    href: "/settings/team",
    icon: Users,
    title: "Team",
    description:
      "View team members, manage roles, and invite new brokers to your agency.",
    available: true,
  },
  {
    href: "/settings/lead-sources",
    icon: Radio,
    title: "Lead Sources",
    description:
      "Manage the channels through which inquiries arrive (portals, referrals, website, etc.)",
    available: true,
  },
  {
    href: "/settings/stages",
    icon: Settings,
    title: "Pipeline Stages",
    description:
      "Configure your opportunity pipeline stages and their ordering.",
    available: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Quickly access your account and agency configuration.
        </p>
      </div>

      <div className="space-y-3">
        {settingSections.map((section) => {
          const Icon = section.icon;
          if (!section.available) {
            return (
              <div
                key={section.href}
                className="flex items-center justify-between rounded-lg border bg-card p-5 opacity-50 cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-md bg-muted p-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{section.title}</p>
                      {section.badge && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {section.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            );
          }

          return (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center justify-between rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{section.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
