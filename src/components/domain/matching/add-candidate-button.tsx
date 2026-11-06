"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMatchCandidateAction } from "@/app/(dashboard)/opportunities/[id]/properties/actions";

/** "Add as candidate" on a match row: links the property to the deal, recorded as from the matches. */
export function AddCandidateButton({ opportunityId, propertyId, code }: { opportunityId: string; propertyId: string; code: string }) {
  const t = useTranslations("matching");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await addMatchCandidateAction(opportunityId, propertyId);
      if (!result.success) toast.error(result.error);
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={add} disabled={pending} aria-label={t("addCandidateFor", { code })}>
      <Plus className="mr-1 h-4 w-4" />
      {t("addCandidate")}
    </Button>
  );
}
