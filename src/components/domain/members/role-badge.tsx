import { Badge } from "@/components/ui/badge";
import type { MemberRole } from "@/domain/members/types";

interface RoleBadgeProps {
  role: MemberRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  switch (role) {
    case "owner":
      return (
        <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30">
          Owner
        </Badge>
      );
    case "manager":
      return <Badge variant="secondary">Manager</Badge>;
    case "broker":
      return <Badge variant="outline">Broker</Badge>;
  }
}
