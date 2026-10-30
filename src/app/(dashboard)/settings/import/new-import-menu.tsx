"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// A client component because a Base UI `render` element sent from a Server Component
// reaches the client lazy, and Base UI then merges its props differently than on the server.
export function NewImportMenu() {
  const t = useTranslations("SettingsImport");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        {t("newImport")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/settings/import/new?type=contact" className="w-full" />}>
          {t("importContacts")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/import/new?type=inquiry" className="w-full" />}>
          {t("importInquiries")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
