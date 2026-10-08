"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { LogOut, User, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CommandPalette } from "@/components/domain/search/command-palette";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";
import { MobileSidebar } from "./sidebar";

interface UserInfo {
  email: string;
  fullName: string;
  agencyName: string;
}

interface HeaderProps {
  userRole?: string;
}

export function Header({ userRole = "broker" }: HeaderProps) {
  const router = useRouter();
  const t = useTranslations("header");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Get agency name
        const { data: membership } = await supabase
          .from("agency_memberships")
          .select("agencies(name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agencyData = membership?.agencies as unknown as { name: string } | null;

        setUserInfo({
          email: user.email ?? "",
          fullName: user.user_metadata?.full_name ?? user.email ?? "",
          agencyName: agencyData?.name ?? t("myAgency"),
        });
      }
    }
    loadUser();
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      <MobileSidebar userRole={userRole} />
      
      {/* Agency name */}
      <div className="flex-1 hidden md:flex">
        <h2 className="text-sm font-semibold text-foreground">
          {userInfo?.agencyName ?? t("loading")}
        </h2>
      </div>

      {/* Global Search */}
      <div className="flex-1 flex justify-center hidden md:flex">
        <CommandPalette />
      </div>

      {/* User menu */}
      <div className="relative flex-1 flex justify-end">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Avatar className="h-8 w-8 border">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {userInfo?.fullName?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline font-medium text-foreground">
            {userInfo?.fullName ?? t("loading")}
          </span>
        </button>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            {/* Dropdown */}
            <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
              <div className="px-3 py-2 text-sm">
                <p className="font-medium">{userInfo?.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {userInfo?.email}
                </p>
              </div>
              <div className="my-1 h-px bg-border" />
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                {t("settings")}
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("signOut")}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
