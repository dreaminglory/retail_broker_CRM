import { Badge } from "@/components/ui/badge";
import type { MemberRole } from "@/domain/members/types";

interface RoleBadgeProps {
  role: MemberRole;
}

import { useTranslations } from "next-intl";

export function RoleBadge({ role }: RoleBadgeProps) {
  const t = useTranslations("SettingsTeam.roles");
  switch (role) {
    case "owner":
      return (
        <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30">
          {t("owner")}
        </Badge>
      );
    case "manager":
      return <Badge variant="secondary">{t("manager")}</Badge>;
    case "broker":
      return <Badge variant="outline">{t("broker")}</Badge>;
  }
}
