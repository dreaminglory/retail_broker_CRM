"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Stage } from "@/domain/stages/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Contact } from "@/domain/contacts/types";
import type { ActiveBroker } from "@/domain/members/types";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import type { ActionResult } from "@/lib/actions";
import { useTranslations } from "next-intl";

interface OpportunityFormProps {
  opportunity?: Opportunity;
  stages: Stage[];
  leadSources: LeadSource[];
  contacts: Contact[];
  brokers: ActiveBroker[];
  createAction: (prevState: ActionResult, formData: FormData) => Promise<ActionResult<{ id: string }>>;
  updateAction?: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  onSuccess?: (id?: string) => void;
  defaultInquiryId?: string;
  defaultContactId?: string;
}

const initialState: ActionResult<{ id: string }> = { success: false, error: "" };

export function OpportunityForm({
  opportunity,
  stages,
  leadSources,
  contacts,
  brokers,
  createAction,
  updateAction,
  onSuccess,
  defaultInquiryId,
  defaultContactId,
}: OpportunityFormProps) {
  const t = useTranslations("OpportunityForm");
  const enums = useTranslations("Enums");
  const getStageName = useStageTranslation();
  
  const isEdit = !!opportunity;
  const action = isEdit && updateAction ? updateAction : createAction;

  const [state, formAction, pending] = useActionState(
    action as (prevState: ActionResult<{ id: string }>, formData: FormData) => Promise<ActionResult<{ id: string }>>,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [resetKey, setResetKey] = useState(0);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (state.success) {
      const successId = state.success ? state.data?.id : undefined;
      if (!isEdit) {
        formRef.current?.reset();
        setTimeout(() => setResetKey((k) => k + 1), 0);
      }
      onSuccessRef.current?.(successId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const fieldErrors = !state.success ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-5" key={resetKey}>
      {/* Hidden inquiry ID if creating from conversion */}
      {defaultInquiryId && !isEdit && (
        <input type="hidden" name="inquiry_id" value={defaultInquiryId} />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">
          {t("titleLabel")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          defaultValue={opportunity?.title ?? ""}
          maxLength={300}
          placeholder={t("titlePlaceholder")}
          required
          aria-invalid={!!fieldErrors?.title}
        />
        {fieldErrors?.title && (
          <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">
            {t("typeLabel")} <span className="text-destructive">*</span>
          </Label>
          <Select
            key={`type-${opportunity?.type ?? "buyer"}`}
            name="type"
            defaultValue={opportunity?.type ?? "buyer"}
            required
          >
            <SelectTrigger id="type">
              <SelectValue>
                {(val) => {
                  switch (val) {
                    case "buyer": return enums("opportunityType.buyer");
                    case "seller": return enums("opportunityType.seller");
                    case "tenant": return enums("opportunityType.tenant");
                    case "landlord": return enums("opportunityType.landlord");
                    default: return t("typePlaceholder");
                  }
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">{enums("opportunityType.buyer")}</SelectItem>
              <SelectItem value="seller">{enums("opportunityType.seller")}</SelectItem>
              <SelectItem value="tenant">{enums("opportunityType.tenant")}</SelectItem>
              <SelectItem value="landlord">{enums("opportunityType.landlord")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stage_id">
            {t("stageLabel")} <span className="text-destructive">*</span>
          </Label>
          <Select
            key={`stage-${opportunity?.stage_id ?? (stages.length > 0 ? stages[0].id : "empty")}`}
            name="stage_id"
            defaultValue={opportunity?.stage_id ?? (stages.length > 0 ? stages[0].id : undefined)}
            required
          >
            <SelectTrigger id="stage_id">
              <SelectValue>
                {(val) => getStageName(stages.find((s) => s.id === val)?.name) || t("stagePlaceholder")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {getStageName(s.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="primary_contact_id">{t("primaryContactLabel")}</Label>
          <Select
            key={`contact-${opportunity?.primary_contact_id ?? defaultContactId ?? "none"}`}
            name="primary_contact_id"
            defaultValue={opportunity?.primary_contact_id ?? defaultContactId ?? "none"}
          >
            <SelectTrigger id="primary_contact_id">
              <SelectValue placeholder={t("primaryContactPlaceholder")}>
                {(val) => {
                  if (val === "none") return t("none");
                  return contacts.find((c) => c.id === val)?.display_name ?? t("primaryContactPlaceholder");
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-muted-foreground italic">{t("none")}</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="source_id">{t("sourceLabel")}</Label>
          <Select
            key={`source-${opportunity?.source_id ?? "none"}`}
            name="source_id"
            defaultValue={opportunity?.source_id ?? "none"}
          >
            <SelectTrigger id="source_id">
              <SelectValue placeholder={t("sourcePlaceholder")}>
                {(val) => {
                  if (val === "none") return t("none");
                  return leadSources.find((s) => s.id === val)?.name ?? t("sourcePlaceholder");
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-muted-foreground italic">{t("none")}</SelectItem>
              {leadSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="assigned-to">{t("assignedToLabel")}</Label>
        <BrokerSelect
          name="assigned_to"
          brokers={brokers}
          defaultValue={opportunity?.assigned_to ?? null}
        />
        {fieldErrors?.assigned_to && (
          <p className="text-xs text-destructive">{fieldErrors.assigned_to[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="temperature">{t("temperatureLabel")}</Label>
          <Select
            key={`temperature-${opportunity?.temperature ?? "warm"}`}
            name="temperature"
            defaultValue={opportunity?.temperature ?? "warm"}
          >
            <SelectTrigger id="temperature">
              <SelectValue>
                {(val) => {
                  switch (val) {
                    case "hot": return t("hot");
                    case "warm": return t("warm");
                    case "cold": return t("cold");
                    default: return t("temperaturePlaceholder");
                  }
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hot">{t("hot")}</SelectItem>
              <SelectItem value="warm">{t("warm")}</SelectItem>
              <SelectItem value="cold">{t("cold")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expected_value">{t("expectedValueLabel")}</Label>
          <Input
            id="expected_value"
            name="expected_value"
            type="number"
            min="0"
            step="0.01"
            defaultValue={opportunity?.expected_value ?? ""}
            placeholder={t("expectedValuePlaceholder")}
            aria-invalid={!!fieldErrors?.expected_value}
          />
          {fieldErrors?.expected_value && (
            <p className="text-xs text-destructive">{fieldErrors.expected_value[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("notesLabel")}</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={opportunity?.notes ?? ""}
          maxLength={10000}
          placeholder={t("notesPlaceholder")}
          rows={4}
        />
      </div>

      {/* Global error */}
      {!state.success && state.error && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("savingBtn") : isEdit ? t("submitEdit") : t("submitCreate")}
      </Button>
    </form>
  );
}
