"use client";

import { useActionState, useEffect, useState, useRef, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Inquiry, JoinableOpportunity } from "@/domain/inquiries/types";
import { parseAgencyLocal, toAgencyLocalInput } from "@/lib/time/agency-day";
import { JoinOpportunityStep, type CallBackDraft } from "./join-opportunity-step";
import type { Stage } from "@/domain/stages/types";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";
import { ContactCombobox } from "@/components/domain/contacts/contact-combobox";
import type { ContactOption } from "@/domain/contacts/types";
import type { ActionResult } from "@/lib/actions";
import type { ActiveBroker } from "@/domain/members/types";
import { UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import type { PotentialDuplicate } from "@/domain/contacts/duplicate-detection";
import { DuplicateSuggestionModal } from "@/components/domain/contacts/duplicate-suggestion-modal";
import { useTranslations } from "next-intl";

// ── Constants ─────────────────────────────────────────────────────────────────

const OPPORTUNITY_TYPES = [
  { value: "buyer" },
  { value: "seller" },
  { value: "landlord" },
  { value: "tenant" },
] as const;

type ConvertResult = ActionResult<{
  opportunityId: string;
  contactId: string | null;
} | { duplicates: PotentialDuplicate[] }>;

const INITIAL_STATE: ConvertResult = { success: false, error: "" };

type JoinResult = ActionResult<{ opportunityId: string; reactivated: boolean }>;
const INITIAL_JOIN_STATE: JoinResult = { success: false, error: "" };
const HOUR_MS = 3_600_000;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConvertInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: Inquiry;
  stages: Stage[];
  brokers: ActiveBroker[];
  convertAction: (
    id: string,
    prevState: ActionResult,
    formData: FormData
  ) => Promise<ConvertResult>;
  joinAction: (
    id: string,
    prevState: ActionResult,
    formData: FormData
  ) => Promise<JoinResult>;
  listJoinableAction: (contactId: string) => Promise<ActionResult<JoinableOpportunity[]>>;
  /** Agency timezone: the call back's time is entered and shown in it. */
  timeZone: string;
  onSuccess?: (opportunityId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConvertInquiryDialog({
  open,
  onOpenChange,
  inquiry,
  stages,
  brokers,
  convertAction,
  joinAction,
  listJoinableAction,
  timeZone,
  onSuccess,
}: ConvertInquiryDialogProps) {
  const t = useTranslations("ConvertInquiryDialog");
  const enums = useTranslations("Enums");
  const getStageName = useStageTranslation();
  
  // Bind the inquiry id into the action to match (prevState, formData) signature
  const boundAction = convertAction.bind(null, inquiry.id);
  const [state, formAction, pending] = useActionState(
    boundAction as (
      prevState: ConvertResult,
      formData: FormData
    ) => Promise<ConvertResult>,
    INITIAL_STATE
  );
  
  const [joinState, joinFormAction, joinPending] = useActionState(
    joinAction.bind(null, inquiry.id) as (
      prevState: JoinResult,
      formData: FormData
    ) => Promise<JoinResult>,
    INITIAL_JOIN_STATE
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [suggestedDuplicates, setSuggestedDuplicates] = useState<PotentialDuplicate[]>([]);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  // Contact tab: "new" | "existing"
  const [contactTab, setContactTab] = useState<"new" | "existing">("new");
  // Kept here so the pick survives switching to "Create new" and back.
  const [existingContact, setExistingContact] = useState<ContactOption | null>(null);

  // New contact fields
  const [newContactType, setNewContactType] = useState<"person" | "organization">("person");
  const [newFirstName, setNewFirstName] = useState(
    inquiry.caller_name?.split(" ")[0] ?? ""
  );
  const [newLastName, setNewLastName] = useState(
    inquiry.caller_name?.split(" ").slice(1).join(" ") ?? ""
  );

  // Join (AD-061): offered when the chosen existing contact has open deals.
  const [oppMode, setOppMode] = useState<"new" | "join">("new");
  const [deals, setDeals] = useState<JoinableOpportunity[]>([]);
  const [dealsStatus, setDealsStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [callBack, setCallBack] = useState<CallBackDraft>({ enabled: true, title: "", due: "" });
  const dealsRequest = useRef(0);
  const handledJoin = useRef<JoinResult | null>(null);
  const callerName = inquiry.caller_name ?? inquiry.caller_phone ?? inquiry.caller_email ?? "";

  const joining = oppMode === "join";
  const callBackDue = callBack.enabled ? parseAgencyLocal(callBack.due, timeZone) : null;
  const callBackInvalid = joining && callBack.enabled && (!callBackDue || !callBack.title.trim());
  const taskJson =
    joining && callBack.enabled && callBackDue
      ? JSON.stringify({ title: callBack.title.trim(), due_at: callBackDue.toISOString() })
      : "";

  function pickContact(contact: ContactOption | null) {
    setExistingContact(contact);
    setOppMode("new");
    setDeals([]);
    setSelectedDealId(null);
    const request = ++dealsRequest.current;
    if (!contact) {
      setDealsStatus("idle");
      return;
    }
    setDealsStatus("loading");
    listJoinableAction(contact.id)
      .then((result) => {
        if (request !== dealsRequest.current) return;
        setDeals(result.success ? result.data : []);
        setDealsStatus(result.success ? "ready" : "failed");
      })
      .catch(() => {
        if (request === dealsRequest.current) setDealsStatus("failed");
      });
  }

  function chooseTab(tab: "new" | "existing") {
    setContactTab(tab);
    if (tab === "new") setOppMode("new");
  }

  function chooseMode(mode: "new" | "join") {
    setOppMode(mode);
    if (mode !== "join") return;
    setSelectedDealId((current) => current ?? deals[0]?.id ?? null);
    setCallBack((prev) => ({
      ...prev,
      title: prev.title || t("callBackTitle", { name: callerName }),
      due: prev.due || toAgencyLocalInput(new Date(Date.now() + HOUR_MS).toISOString(), timeZone),
    }));
  }

  // The joined deal is the destination, once per result.
  useEffect(() => {
    if (!joinState.success || !joinState.data || handledJoin.current === joinState) return;
    handledJoin.current = joinState;
    onOpenChange(false);
    onSuccess?.(joinState.data.opportunityId);
  }, [joinState, onOpenChange, onSuccess]);

  // Redirect on success or handle duplicates
  useEffect(() => {
    if (state.success && state.data) {
      if ('duplicates' in state.data && Array.isArray(state.data.duplicates)) {
        const duplicates = state.data.duplicates;
        setTimeout(() => setSuggestedDuplicates(duplicates), 0);
      } else if ('opportunityId' in state.data) {
        const opportunityId = state.data.opportunityId;
        onOpenChange(false);
        onSuccess?.(opportunityId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // JSON payload for the hidden create_contact field
  const createContactJson =
    contactTab === "new"
      ? JSON.stringify({
          type: newContactType,
          first_name:
            newContactType === "person" ? newFirstName || null : null,
          last_name:
            newContactType === "person" ? newLastName || null : null,
          company_name:
            newContactType === "organization" ? newFirstName || null : null,
        })
      : "";

  const defaultTitle = inquiry.subject ?? inquiry.caller_name ?? "";
  const defaultStageId = stages[0]?.id ?? "";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      if (joining) joinFormAction(formData);
      else formAction(formData);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1" ref={formRef}>
          {/* ── Contact section ───────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t("contactSection")}</Label>

            {/* Manual tab switcher (no tabs component available) */}
            <div className="flex rounded-lg border p-0.5 bg-muted/40 gap-0.5">
              <button
                type="button"
                onClick={() => chooseTab("new")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  contactTab === "new"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                id="convert-tab-new"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t("contactTabNew")}
              </button>
              <button
                type="button"
                onClick={() => chooseTab("existing")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  contactTab === "existing"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                id="convert-tab-existing"
              >
                <Users className="h-3.5 w-3.5" />
                {t("contactTabExisting")}
              </button>
            </div>

            {/* New contact panel */}
            {contactTab === "new" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="new-contact-type">{t("newContactType")}</Label>
                  <Select
                    value={newContactType}
                    onValueChange={(v) =>
                      setNewContactType((v as string ?? "person") as "person" | "organization")
                    }
                  >
                    <SelectTrigger id="new-contact-type">
                      <SelectValue>
                        {(val: string) => val === "person" ? t("typePerson") : t("typeOrganization")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">{t("typePerson")}</SelectItem>
                      <SelectItem value="organization">{t("typeOrganization")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newContactType === "person" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-first-name">{t("firstName")}</Label>
                      <Input
                        id="new-first-name"
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        placeholder={t("firstNamePlaceholder")}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-last-name">{t("lastName")}</Label>
                      <Input
                        id="new-last-name"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        placeholder={t("lastNamePlaceholder")}
                        maxLength={100}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="new-company-name">{t("companyName")}</Label>
                    <Input
                      id="new-company-name"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder={t("companyNamePlaceholder")}
                      maxLength={200}
                    />
                  </div>
                )}

                {/* Hidden field carries serialised contact */}
                <input
                  type="hidden"
                  name="create_contact"
                  value={createContactJson}
                />
              </div>
            )}

            {/* Existing contact picker */}
            {contactTab === "existing" && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="convert-contact-search" className="sr-only">
                  {t("existingContactLabel")}
                </Label>
                <ContactCombobox
                  id="convert-contact-search"
                  name="contact_id"
                  defaultValue={existingContact}
                  onChange={pickContact}
                  required
                  invalid={!state.success && !!state.fieldErrors?.contact_id}
                />

                {!state.success && state.fieldErrors?.contact_id && (
                  <p className="text-xs text-destructive">
                    {state.fieldErrors.contact_id[0]}
                  </p>
                )}

                {dealsStatus === "failed" && (
                  <p className="text-xs text-muted-foreground" role="status">{t("joinLoadFailed")}</p>
                )}
                {dealsStatus === "ready" && deals.length > 0 && (
                  <div className="space-y-1.5 pt-1" role="radiogroup" aria-label={t("modeLabel")}>
                    <div className="flex rounded-lg border p-0.5 bg-muted/40 gap-0.5">
                      {(["new", "join"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          role="radio"
                          aria-checked={oppMode === mode}
                          onClick={() => chooseMode(mode)}
                          id={`convert-mode-${mode}`}
                          className={cn(
                            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            oppMode === mode
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {mode === "new" ? t("modeNew") : t("modeJoin")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {joining && (
            <>
              <JoinOpportunityStep
                deals={deals}
                selectedId={selectedDealId}
                onSelect={setSelectedDealId}
                callBack={callBack}
                onCallBackChange={setCallBack}
                timeZone={timeZone}
                invalidDeal={!joinState.success && !!joinState.fieldErrors?.opportunity_id}
              />
              <input type="hidden" name="opportunity_id" value={selectedDealId ?? ""} />
              <input type="hidden" name="task" value={taskJson} />
            </>
          )}

          {/* ── Opportunity details ───────────────────────────────────────── */}
          {!joining && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">{t("opportunitySection")}</Label>

            <div className="space-y-1.5">
              <Label htmlFor="opp-title">
                {t("oppTitle")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="opp-title"
                name="opportunity_title"
                defaultValue={defaultTitle}
                maxLength={300}
                placeholder={t("oppTitlePlaceholder")}
                required
                aria-invalid={
                  !state.success && !!state.fieldErrors?.opportunity_title
                }
              />
              {!state.success && state.fieldErrors?.opportunity_title && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.opportunity_title[0]}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="opp-type">
                  {t("oppType")} <span className="text-destructive">*</span>
                </Label>
                <Select name="opportunity_type" defaultValue="buyer">
                  <SelectTrigger id="opp-type">
                    <SelectValue>
                      {(val) => OPPORTUNITY_TYPES.find((type) => type.value === val) ? enums(`opportunityType.${val}`) : t("oppTypePlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {enums(`opportunityType.${type.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!state.success && state.fieldErrors?.opportunity_type && (
                  <p className="text-xs text-destructive">
                    {state.fieldErrors.opportunity_type[0]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="opp-stage">
                  {t("oppStage")} <span className="text-destructive">*</span>
                </Label>
                <Select name="stage_id" defaultValue={defaultStageId}>
                  <SelectTrigger id="opp-stage">
                    <SelectValue placeholder={t("oppStagePlaceholder")}>
                      {(val) => getStageName(stages.find((s) => s.id === val)?.name) || t("oppStagePlaceholder")}
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
                {!state.success && state.fieldErrors?.stage_id && (
                  <p className="text-xs text-destructive">
                    {state.fieldErrors.stage_id[0]}
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="convert-assigned-to">{t("assignedTo")}</Label>
              <BrokerSelect
                name="assigned_to"
                brokers={brokers}
                defaultValue={inquiry.assigned_to ?? null}
              />
              {!state.success && state.fieldErrors?.assigned_to && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.assigned_to[0]}
                </p>
              )}
            </div>
          </div>
          )}

          {/* Global error */}
          {!joining && !state.success && state.error && !state.fieldErrors && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {joining && !joinState.success && joinState.error && (
            <p className="text-sm text-destructive" role="alert">
              {joinState.error}
            </p>
          )}
          
          <input type="hidden" name="skipDuplicateCheck" value={skipDuplicateCheck ? "true" : "false"} />

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={pending || joinPending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={joining ? joinPending || !selectedDealId || callBackInvalid : pending}
              id="convert-inquiry-submit"
            >
              {joining
                ? joinPending ? t("joining") : t("join")
                : pending ? t("converting") : t("convert")}
            </Button>
          </div>
        </form>

        {suggestedDuplicates.length > 0 && (
          <DuplicateSuggestionModal
            open={suggestedDuplicates.length > 0}
            onOpenChange={(open) => {
              if (!open) setSuggestedDuplicates([]);
            }}
            duplicates={suggestedDuplicates}
            isSubmitting={pending}
            onUseContact={(contact) => {
              setSuggestedDuplicates([]);
              setContactTab("existing");
              pickContact({
                id: contact.id,
                display_name: contact.display_name,
                company_name: contact.company_name,
                type: contact.type,
              });
            }}
            onProceedAnyway={() => {
              setSkipDuplicateCheck(true);
              setSuggestedDuplicates([]);
              setTimeout(() => {
                formRef.current?.requestSubmit();
              }, 0);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
