"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendInvitation } from "@/app/(dashboard)/settings/team/actions";

/** Sends a pending invitation again; the server refuses a repeat within 5 minutes and says when. */
export function ResendInvitationButton({ membershipId }: { membershipId: string }) {
  const t = useTranslations("SettingsTeam.resend");
  const [sending, setSending] = useState(false);

  async function handleClick() {
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("membershipId", membershipId);
      const result = await resendInvitation(formData);
      if (result.success) toast.success(t("sent"));
      else toast.error(result.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={sending} onClick={handleClick} id={`resend-invitation-${membershipId}`}>
      {sending ? t("sending") : t("button")}
    </Button>
  );
}
