"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import { createTaskAction } from "@/app/(dashboard)/opportunities/[id]/tasks/actions";
import type { ActiveBroker } from "@/domain/members/types";
import type { ActionResult } from "@/lib/actions";

type Deal = { id: string; title: string };

type ScheduleViewingButtonProps = {
  propertyId: string;
  /** "#1042", for the default title. */
  code: string;
  /** The active buyer and tenant deals this property is a candidate on. */
  deals: Deal[];
  brokers: ActiveBroker[];
};

const initialState: ActionResult<{ id: string }> = { success: false, error: "" };
/** createTaskAction ignores its previous state. */
const initialVoid: ActionResult = { success: false, error: "" };

/** Schedules a viewing task of this property on one of its deals (spec: properties, rule 7). */
export function ScheduleViewingButton({ propertyId, code, deals, brokers }: ScheduleViewingButtonProps) {
  const t = useTranslations("PropertyViewing");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Eye className="mr-1 h-4 w-4" />
        {t("schedule")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule")}</DialogTitle>
          </DialogHeader>
          {open &&
            (deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noDeals")}</p>
            ) : (
              <ScheduleViewingForm
                propertyId={propertyId}
                code={code}
                deals={deals}
                brokers={brokers}
                onDone={() => setOpen(false)}
              />
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScheduleViewingForm({
  propertyId,
  code,
  deals,
  brokers,
  onDone,
}: Omit<ScheduleViewingButtonProps, "deals"> & { deals: Deal[]; onDone: () => void }) {
  const t = useTranslations("PropertyViewing");
  const router = useRouter();
  const [dealId, setDealId] = useState(deals.length === 1 ? deals[0].id : "");
  // The deal is chosen in the form, so the action is bound per submit.
  const [state, formAction, pending] = useActionState(
    (_previous: ActionResult<{ id: string }>, formData: FormData) =>
      createTaskAction(String(formData.get("opportunity_id") ?? ""), initialVoid, formData),
    initialState
  );

  useEffect(() => {
    if (!state.success) return;
    toast.success(t("scheduled"));
    onDone();
    router.refresh();
  }, [state, onDone, router, t]);

  const fieldErrors = !state.success ? state.fieldErrors : undefined;
  const formError = !state.success && state.error && !state.fieldErrors ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="task_type" value="viewing" />
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="opportunity_id" value={dealId} />

      <div className="space-y-1.5">
        <Label htmlFor="viewing-deal">{t("deal")}</Label>
        <Select value={dealId} onValueChange={(value) => setDealId((value as string) ?? "")} required>
          <SelectTrigger id="viewing-deal" className="w-full">
            <SelectValue>{(value: string) => deals.find((deal) => deal.id === value)?.title ?? t("dealPlaceholder")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {deals.map((deal) => (
              <SelectItem key={deal.id} value={deal.id}>
                {deal.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="viewing-title">{t("title")}</Label>
        <Input id="viewing-title" name="title" required maxLength={150} defaultValue={t("defaultTitle", { code })} />
        {fieldErrors?.title && <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="viewing-due">{t("dueAt")}</Label>
        <Input id="viewing-due" name="due_at" type="datetime-local" />
        {fieldErrors?.due_at && <p className="text-xs text-destructive">{fieldErrors.due_at[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>{t("assignedTo")}</Label>
        <BrokerSelect name="assigned_to" brokers={brokers} ariaLabel={t("assignedTo")} />
      </div>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending || !dealId} className="w-full">
        {pending ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
