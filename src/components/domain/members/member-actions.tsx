"use client";

import { useState } from "react";
import { MoreHorizontal, Crown, ShieldCheck, User, UserX, UserCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateMemberRole, deactivateMember, reactivateMember, cancelInvitation } from "@/app/(dashboard)/settings/team/actions";
import { toast } from "sonner";
import type { MemberRole, MemberStatus } from "@/domain/members/types";

interface MemberActionsProps {
  membershipId: string;
  currentRole: MemberRole;
  status: MemberStatus;
  canManage: boolean;
  isSelf: boolean;
}

import { useTranslations } from "next-intl";

export function MemberActions({ membershipId, currentRole, status, canManage, isSelf }: MemberActionsProps) {
  const t = useTranslations("SettingsTeam.actions");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!canManage) return null;

  async function handleRoleChange(newRole: MemberRole) {
    if (newRole === currentRole) return;
    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append("membershipId", membershipId);
      formData.append("role", newRole);
      
      const result = await updateMemberRole(formData);
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success(t("roleUpdated"));
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleStatusChange(newStatus: "active" | "deactivated" | "cancelled") {
    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append("membershipId", membershipId);
      
      let result;
      if (newStatus === "active") {
        result = await reactivateMember(formData);
      } else if (newStatus === "deactivated") {
        result = await deactivateMember(formData);
      } else if (newStatus === "cancelled") {
        result = await cancelInvitation(formData);
      }
      
      if (!result?.success) {
        toast.error(result?.error || t("unknownError"));
      } else {
        toast.success(
          newStatus === "active" ? t("memberReactivated") : 
          newStatus === "deactivated" ? t("memberDeactivated") : 
          t("invitationCancelled")
        );
      }
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0")} 
        disabled={isUpdating}
      >
        <span className="sr-only">{t("openMenu")}</span>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("changeRole")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleRoleChange("owner")} disabled={currentRole === "owner"}>
            <Crown className="mr-2 h-4 w-4" />
            <Crown className="mr-2 h-4 w-4" />
            {t("makeOwner")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange("manager")} disabled={currentRole === "manager"}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            <ShieldCheck className="mr-2 h-4 w-4" />
            {t("makeManager")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange("broker")} disabled={currentRole === "broker"}>
            <User className="mr-2 h-4 w-4" />
            <User className="mr-2 h-4 w-4" />
            {t("makeBroker")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {status === "invited" ? (
                <DropdownMenuItem 
                  onClick={() => handleStatusChange("cancelled")}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  <UserX className="mr-2 h-4 w-4" />
                  {t("cancelInvitation")}
                </DropdownMenuItem>
              ) : status === "active" ? (
                <DropdownMenuItem 
                  onClick={() => handleStatusChange("deactivated")}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  <UserX className="mr-2 h-4 w-4" />
                  {t("deactivateMember")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleStatusChange("active")}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  <UserCheck className="mr-2 h-4 w-4" />
                  {t("reactivateMember")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
