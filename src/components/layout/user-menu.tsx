"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ShellUser } from "./shell-types";

/** Up to two initials from a name or an email ("Мария Колева" → "МК"). */
export function initials(name: string): string {
  const words = name.split(/[\s@._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join("");
}

/**
 * The user block at the foot of the sidebar (name, role, settings), opening the
 * profile menu that used to sit in the header: settings and sign out.
 */
export function UserMenu({ user, collapsed = false }: { user: ShellUser; collapsed?: boolean }) {
  const router = useRouter();
  const t = useTranslations("header");
  const tNav = useTranslations("nav");
  const tRoles = useTranslations("SettingsTeam.roles");

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tNav("userMenu")}
        className={cn(
          "flex w-full items-center gap-3 rounded-md p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar data-popup-open:bg-accent",
          collapsed && "justify-center p-1.5",
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-strong text-ink">{user.fullName}</span>
              <span className="block truncate text-small text-muted-foreground">{tRoles(user.role)}</span>
            </span>
            <Settings className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-body-strong text-ink">{user.fullName}</span>
            <span className="block truncate text-small text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4 text-muted-foreground" />
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
