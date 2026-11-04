"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PropertyPicker } from "@/components/domain/properties/property-picker";
import { propertyCode, propertyHeadline } from "@/components/domain/properties/property-labels";
import {
  addCandidatePropertyAction,
  removePropertyLinkAction,
  setPropertyLinkStatusAction,
} from "@/app/(dashboard)/opportunities/[id]/properties/actions";
import type { OpportunityPropertyWithProperty, PropertyLinkStatus } from "@/domain/opportunity-properties/types";
import { PROPERTY_LINK_STATUSES } from "@/domain/opportunity-properties/validation";
import type { ActionResult } from "@/lib/actions";

type PropertyLinksProps = {
  opportunityId: string;
  links: OpportunityPropertyWithProperty[];
};

const initialState: ActionResult = { success: false, error: "" };

/** Candidate properties on a buyer or tenant deal, with their status (rules 5–6). */
export function PropertyLinks({ opportunityId, links }: PropertyLinksProps) {
  const t = useTranslations("PropertyLinks");
  const enums = useTranslations("Enums");
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState<OpportunityPropertyWithProperty | null>(null);
  const [pending, startTransition] = useTransition();

  function setStatus(link: OpportunityPropertyWithProperty, status: PropertyLinkStatus, reason: string | null = null) {
    startTransition(async () => {
      const result = await setPropertyLinkStatusAction(link.id, { status, rejected_reason: reason });
      if (!result.success) toast.error(result.error);
      else setRejecting(null);
    });
  }

  function remove(link: OpportunityPropertyWithProperty) {
    startTransition(async () => {
      const result = await removePropertyLinkAction(link.id);
      if (!result.success) toast.error(result.error);
    });
  }

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="opportunity-properties">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
        <h3 id="opportunity-properties" className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t("addCandidate")}
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y">
          {links.map((link) => {
            const code = propertyCode(link.property);
            return (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Link href={`/properties/${link.property.id}`} className="flex flex-wrap items-center gap-2 hover:underline">
                    <span className="font-mono text-xs text-muted-foreground">{code}</span>
                    <span className="text-sm font-medium">{propertyHeadline(enums, link.property)}</span>
                    {link.property.status === "archived" && <Badge variant="outline">{t("archived")}</Badge>}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {[link.property.area_name, link.property.settlement_name, link.property.address].filter(Boolean).join(", ")}
                  </p>
                  {link.status === "rejected" && link.rejected_reason && (
                    <p className="text-xs text-muted-foreground">{t("rejectedBecause", { reason: link.rejected_reason })}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Select
                    value={link.status ?? "candidate"}
                    disabled={pending}
                    onValueChange={(value) => {
                      const status = value as PropertyLinkStatus;
                      if (status === link.status) return;
                      if (status === "rejected") setRejecting(link);
                      else setStatus(link, status);
                    }}
                  >
                    <SelectTrigger className="h-8 w-36" aria-label={t("statusOf", { code })}>
                      <SelectValue>{(value: string) => enums(`propertyLinkStatus.${value}` as never)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_LINK_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {enums(`propertyLinkStatus.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={pending}
                    onClick={() => remove(link)}
                    aria-label={t("removeLink", { code })}
                    title={t("remove")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addCandidate")}</DialogTitle>
          </DialogHeader>
          {adding && (
            <AddCandidateForm
              opportunityId={opportunityId}
              linkedIds={links.map((link) => link.property.id)}
              onDone={() => setAdding(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          {rejecting && (
            <RejectForm
              code={propertyCode(rejecting.property)}
              pending={pending}
              onCancel={() => setRejecting(null)}
              onReject={(reason) => setStatus(rejecting, "rejected", reason)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AddCandidateForm({
  opportunityId,
  linkedIds,
  onDone,
}: {
  opportunityId: string;
  linkedIds: string[];
  onDone: () => void;
}) {
  const t = useTranslations("PropertyLinks");
  const [state, formAction, pending] = useActionState(addCandidatePropertyAction.bind(null, opportunityId), initialState);

  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);

  const propertyError = !state.success ? state.fieldErrors?.property_id?.[0] : undefined;
  const formError = !state.success && state.error && !state.fieldErrors ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="candidate-property">{t("property")}</Label>
        <PropertyPicker id="candidate-property" name="property_id" excludeIds={linkedIds} required invalid={!!propertyError} />
        {propertyError && <p className="text-xs text-destructive">{propertyError}</p>}
      </div>
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("saving") : t("add")}
      </Button>
    </form>
  );
}

function RejectForm({
  code,
  pending,
  onCancel,
  onReject,
}: {
  code: string;
  pending: boolean;
  onCancel: () => void;
  onReject: (reason: string | null) => void;
}) {
  const t = useTranslations("PropertyLinks");
  const [reason, setReason] = useState("");

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
        <Label htmlFor="reject-reason">{t("rejectReason")}</Label>
        <Textarea id="reject-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
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
