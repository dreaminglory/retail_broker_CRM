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

interface InviteDialogProps {
  agencyId: string;
}

export function InviteDialog({ agencyId }: InviteDialogProps) {
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
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Invitation sent to ${email}`);
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
        Invite Member
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleInvite}>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an email invitation to join your agency.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
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
              Cancel
            </Button>
            <Button type="submit" disabled={isInviting || !email}>
              {isInviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
