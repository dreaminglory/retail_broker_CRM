"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteMember } from "@/app/(dashboard)/settings/team/actions";
import { toast } from "sonner";
import type { MemberRole } from "@/domain/members/types";
import { useTranslations } from "next-intl";

interface InviteDialogProps {
  agencyId: string;
  currentUserRole: MemberRole;
}

export function InviteDialog({ agencyId, currentUserRole }: InviteDialogProps) {
  const t = useTranslations("SettingsTeam.invite");
  const tRoles = useTranslations("SettingsTeam.roles");
  const [open, setOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("broker");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setIsInviting(true);
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("role", role);
      formData.append("agencyId", agencyId);

      const result = await inviteMember(formData);
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success(t("success", { email }));
        setOpen(false);
        setEmail("");
        setRole("broker");
      }
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        className={cn(buttonVariants({ variant: "default" }))}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {t("button")}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleInvite}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">{t("roleLabel")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder={t("selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">{tRoles("broker")}</SelectItem>
                  {currentUserRole === "owner" && (
                    <>
                      <SelectItem value="manager">{tRoles("manager")}</SelectItem>
                      <SelectItem value="owner">{tRoles("owner")}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isInviting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isInviting || !email}>
              {isInviting ? t("sending") : t("send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
