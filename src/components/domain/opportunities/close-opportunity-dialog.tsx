"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { ActionResult } from "@/lib/actions";
import { useTranslations } from "next-intl";

interface CloseOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closeAction: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  onSuccess?: () => void;
}

const initialState: ActionResult = { success: false, error: "" };

export function CloseOpportunityDialog({
  open,
  onOpenChange,
  closeAction,
  onSuccess,
}: CloseOpportunityDialogProps) {
  const t = useTranslations("CloseOpportunityDialog");
  const [state, formAction, isPending] = useActionState(closeAction, initialState);
  const [outcome, setOutcome] = useState<string>("won");

  useEffect(() => {
    if (state.success) {
      onSuccess?.();
    }
  }, [state.success, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="outcome">{t("outcomeLabel")}</Label>
            <Select name="outcome" value={outcome} onValueChange={(v) => { if (v) setOutcome(v as string); }} required>
              <SelectTrigger>
                <SelectValue placeholder={t("outcomePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="won">{t("won")}</SelectItem>
                <SelectItem value="lost">{t("lost")}</SelectItem>
                <SelectItem value="nurture">{t("nurture")}</SelectItem>
              </SelectContent>
            </Select>
            {!state.success && state.fieldErrors?.outcome && (
              <p className="text-sm text-destructive">{state.fieldErrors.outcome[0]}</p>
            )}
          </div>

          {outcome === "lost" && (
            <div className="space-y-2">
              <Label htmlFor="lost_reason">{t("lostReasonLabel")}</Label>
              <Input
                id="lost_reason"
                name="lost_reason"
                placeholder={t("lostReasonPlaceholder")}
                required
              />
              {!state.success && state.fieldErrors?.lost_reason && (
                <p className="text-sm text-destructive">{state.fieldErrors.lost_reason[0]}</p>
              )}
            </div>
          )}

          {!state.success && state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("closingBtn") : t("submitBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
