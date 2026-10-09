import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { AgencyMember } from "@/domain/members/types";
import { RoleBadge } from "./role-badge";
import { MemberActions } from "./member-actions";
import { format } from "date-fns";
import { useTranslations, useFormatter } from "next-intl";

interface MemberListProps {
  members: AgencyMember[];
  currentUserId: string;
  currentUserRole: string;
}

export function MemberList({ members, currentUserId, currentUserRole }: MemberListProps) {
  const t = useTranslations("SettingsTeam");
  const formatLoc = useFormatter();
  const canManage = currentUserRole === "owner";

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.member")}</TableHead>
            <TableHead>{t("columns.role")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("columns.joined")}</TableHead>
            {canManage && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isSelf = member.user_id === currentUserId;
            const displayName = member.profile?.display_name || member.profile?.email || member.invitation_email || t("unknown");
            const email = member.profile?.email || member.invitation_email || t("noEmail");
            const initials = displayName.substring(0, 2).toUpperCase();

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.profile?.avatar_url || ""} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {displayName} {isSelf && <span className="text-muted-foreground font-normal">{t("you")}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={member.role} />
                </TableCell>
                <TableCell>
                  {member.status === "active" ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">{t("status.active")}</Badge>
                  ) : member.status === "invited" ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200">{t("status.invited")}</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">{t("status.deactivated")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.joined_at ? formatLoc.dateTime(new Date(member.joined_at), { month: "short", day: "numeric", year: "numeric" }) : 
                   member.invited_at ? t("invited", { date: formatLoc.dateTime(new Date(member.invited_at), { month: "short", day: "numeric", year: "numeric" }) }) : "-"}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <MemberActions 
                      membershipId={member.id}
                      currentRole={member.role}
                      status={member.status}
                      canManage={canManage}
                      isSelf={isSelf}
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
