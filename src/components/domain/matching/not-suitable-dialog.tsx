"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RejectForm } from "@/components/domain/opportunities/property-links";
import { rejectMatchAction } from "@/app/(dashboard)/opportunities/[id]/properties/actions";

type NotSuitableDialogProps = { opportunityId: string; propertyId: string; code: string };

/** "Not suitable" on a match: asks for an optional reason, then records the property as rejected. */
export function NotSuitableDialog({ opportunityId, propertyId, code }: NotSuitableDialogProps) {
  const t = useTranslations("matching");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function reject(reason: string | null) {
    startTransition(async () => {
      const result = await rejectMatchAction(opportunityId, propertyId, reason);
      if (!result.success) toast.error(result.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={t("notSuitableFor", { code })}>
        <ThumbsDown className="mr-1 h-4 w-4" />
        {t("notSuitable")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <RejectForm code={code} pending={pending} onCancel={() => setOpen(false)} onReject={reject} />
        </DialogContent>
      </Dialog>
    </>
  );
}
