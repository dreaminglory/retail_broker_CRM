"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RejectFormProps = {
  code: string;
  pending: boolean;
  onCancel: () => void;
  onReject: (reason: string | null) => void;
};

/** The body of the "reject this property" dialog: an optional reason (rule 6), then confirm. */
export function RejectForm({ code, pending, onCancel, onReject }: RejectFormProps) {
  const t = useTranslations("PropertyLinks");
  const [reason, setReason] = useState("");
  const reasonId = useId();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onReject(reason.trim() || null);
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>{t("rejectTitle", { code })}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor={reasonId}>{t("rejectReason")}</Label>
        <Textarea id={reasonId} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("reject")}
        </Button>
      </DialogFooter>
    </form>
  );
}
