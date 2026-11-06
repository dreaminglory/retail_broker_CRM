"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JoinableOpportunity } from "@/domain/inquiries/types";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";

export type CallBackDraft = { enabled: boolean; title: string; due: string };

type JoinOpportunityStepProps = {
  deals: JoinableOpportunity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  callBack: CallBackDraft;
  onCallBackChange: (next: CallBackDraft) => void;
  timeZone: string;
  invalidDeal?: boolean;
};

/**
 * The "join an existing opportunity" half of the convert dialog (AD-061): the contact's open
 * deals to pick from, what joining will do to the chosen one, and the optional call back.
 */
export function JoinOpportunityStep({
  deals,
  selectedId,
  onSelect,
  callBack,
  onCallBackChange,
  timeZone,
  invalidDeal,
}: JoinOpportunityStepProps) {
  const t = useTranslations("ConvertInquiryDialog");
  const enums = useTranslations("Enums");
  const format = useFormatter();
  const getStageName = useStageTranslation();
  const selected = deals.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-3" id="join-opportunity-step">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">{t("joinPickLabel")}</legend>
        {deals.map((deal) => (
          <label
            key={deal.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
              deal.id === selectedId ? "border-primary bg-primary/5" : "hover:bg-muted/40",
              invalidDeal && !selected && "border-destructive"
            )}
          >
            <input
              type="radio"
              name="join_deal_choice"
              value={deal.id}
              checked={deal.id === selectedId}
              onChange={() => onSelect(deal.id)}
              className="mt-1"
            />
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{deal.title}</span>
                {deal.status === "nurture" && (
                  <Badge variant="secondary">{t("joinStatusNurture")}</Badge>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                {enums(`opportunityType.${deal.type}`)} · {getStageName(deal.stage_name)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {deal.owner_name ? t("joinOwner", { name: deal.owner_name }) : t("joinNoOwner")}
                {" · "}
                {deal.next_action_at
                  ? t("joinNextAction", {
                      date: format.dateTime(new Date(deal.next_action_at), {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone,
                      }),
                    })
                  : t("joinNoNextAction")}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {selected?.status === "nurture" && (
        <p className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200" role="note">
          {t("joinReactivates")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("joinOwnerNote")}</p>

      <div className="space-y-2 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            id="join-call-back"
            checked={callBack.enabled}
            onChange={(e) => onCallBackChange({ ...callBack, enabled: e.target.checked })}
          />
          {t("callBack")}
        </label>
        {callBack.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="join-call-title">{t("callBackTitleLabel")}</Label>
              <Input
                id="join-call-title"
                value={callBack.title}
                maxLength={300}
                onChange={(e) => onCallBackChange({ ...callBack, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="join-call-due">{t("callBackDue")}</Label>
              <Input
                id="join-call-due"
                type="datetime-local"
                value={callBack.due}
                onChange={(e) => onCallBackChange({ ...callBack, due: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
