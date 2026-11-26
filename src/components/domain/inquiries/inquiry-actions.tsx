"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { inquiryCallTarget } from "@/components/domain/inquiries/inquiry-card";
import { InquiryForm } from "@/components/domain/inquiries/inquiry-form";
import { ConvertInquiryDialog } from "@/components/domain/inquiries/convert-inquiry-dialog";
import { useCallIntent } from "@/components/domain/calls/use-call-intent";
import {
  updateInquiryAction,
  markInquiryContactedAction,
  dismissInquiryAction,
  convertInquiryAction,
  joinInquiryAction,
  listJoinableOpportunitiesAction,
} from "@/app/(dashboard)/inquiries/actions";
import type { Inquiry } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Stage } from "@/domain/stages/types";
import type { ActiveBroker } from "@/domain/members/types";

function DismissSubmitButton() {
  const t = useTranslations("InquiriesPage");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} id="dismiss-inquiry-submit">
      {pending ? t("dismissModal.dismissingBtn") : t("dismissModal.submitBtn")}
    </Button>
  );
}

export type InquiryActionContext = {
  leadSources: LeadSource[];
  stages: Stage[];
  brokers: ActiveBroker[];
  inactiveAssigneeNames: Record<string, string>;
  timeZone: string;
};

export type InquiryHandlers = {
  onEdit: (inquiry: Inquiry) => void;
  onMarkContacted: (id: string) => void;
  onConvert: (inquiry: Inquiry) => void;
  onDismiss: (inquiry: Inquiry) => void;
  onLogCall?: (inquiry: Inquiry) => void;
};

/**
 * An inquiry's actions (edit and reassign, mark contacted, dismiss, convert or join, log a call)
 * and the dialogs they open: shared by the inquiry list (smart lists) and the inquiries page's
 * panel. Each action refreshes the page, so the rows and any count around them follow.
 */
export function useInquiryActions({
  leadSources,
  stages,
  brokers,
  inactiveAssigneeNames,
  timeZone,
}: InquiryActionContext): { handlers: InquiryHandlers; dialogs: ReactNode } {
  const t = useTranslations("InquiriesPage");
  const tCard = useTranslations("InquiryCard");
  const router = useRouter();

  const [editTarget, setEditTarget] = useState<Inquiry | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Inquiry | null>(null);
  const [convertTarget, setConvertTarget] = useState<Inquiry | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  // "Log call" opens the one post-call sheet the dashboard layout mounts (spec phone-loop rule 4).
  const callIntent = useCallIntent();

  // A deactivated assignee stays selectable while editing their inquiry, so the select can name them.
  function brokersWithAssignee(inquiry: Inquiry): ActiveBroker[] {
    const name = inquiry.assigned_to ? inactiveAssigneeNames[inquiry.assigned_to] : undefined;
    if (!inquiry.assigned_to || !name) return brokers;
    return [...brokers, { id: inquiry.assigned_to, display_name: name, email: "", role: "broker" }];
  }

  const handlers: InquiryHandlers = {
    onEdit: setEditTarget,
    onMarkContacted: async (id) => {
      await markInquiryContactedAction(id);
      router.refresh();
    },
    onConvert: (inquiry) => {
      setConvertTarget(inquiry);
      setConvertOpen(true);
    },
    onDismiss: setDismissTarget,
    onLogCall: callIntent
      ? (inquiry) => callIntent.open(inquiryCallTarget(inquiry, tCard("unknownCaller")))
      : undefined,
  };

  const dialogs = (
    <>
      {/* ── Edit dialog ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editInquiryTitle")}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <InquiryForm
              key={editTarget.id}
              createAction={updateInquiryAction.bind(null, editTarget.id)}
              inquiry={editTarget}
              leadSources={leadSources}
              brokers={brokersWithAssignee(editTarget)}
              onSuccess={() => {
                setEditTarget(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dismiss dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!dismissTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setDismissTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("dismissModal.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("dismissModal.warning")}</p>
          {dismissTarget && (
            <form
              action={async (formData: FormData) => {
                const initialState = { success: false as const, error: "" };
                await dismissInquiryAction(dismissTarget.id, initialState, formData);
                setDismissTarget(null);
                router.refresh();
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="dismiss-reason">{t("dismissModal.reasonLabel")}</Label>
                <Textarea
                  id="dismiss-reason"
                  name="dismissed_reason"
                  placeholder={t("dismissModal.reasonPlaceholder")}
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDismissTarget(null)}>
                  {t("dismissModal.cancelBtn")}
                </Button>
                <DismissSubmitButton />
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Convert dialog ───────────────────────────────────────────────────── */}
      {convertTarget && (
        <ConvertInquiryDialog
          open={convertOpen}
          onOpenChange={(open: boolean) => {
            setConvertOpen(open);
            if (!open) setConvertTarget(null);
          }}
          inquiry={convertTarget}
          stages={stages}
          brokers={brokers}
          convertAction={convertInquiryAction}
          joinAction={joinInquiryAction}
          listJoinableAction={listJoinableOpportunitiesAction}
          timeZone={timeZone}
          onSuccess={(opportunityId) => {
            router.push(`/opportunities/${opportunityId}`);
          }}
        />
      )}
    </>
  );

  return { handlers, dialogs };
}
