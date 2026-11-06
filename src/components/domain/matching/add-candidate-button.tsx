"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMatchCandidateAction } from "@/app/(dashboard)/opportunities/[id]/properties/actions";

type AddCandidateButtonProps = {
  opportunityId: string;
  propertyId: string;
  /** The visible text and the accessible name, from the server (it knows which side it is on). */
  label: string;
  ariaLabel: string;
};

/** "Add as candidate" on a match: links the property to the deal, recorded as from the matches. */
export function AddCandidateButton({ opportunityId, propertyId, label, ariaLabel }: AddCandidateButtonProps) {
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await addMatchCandidateAction(opportunityId, propertyId);
      if (!result.success) toast.error(result.error);
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={add} disabled={pending} aria-label={ariaLabel}>
      <Plus className="mr-1 h-4 w-4" />
      {label}
    </Button>
  );
}
