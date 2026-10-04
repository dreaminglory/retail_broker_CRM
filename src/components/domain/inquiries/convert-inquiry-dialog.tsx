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
import type { Inquiry } from "@/domain/inquiries/types";
import type { Stage } from "@/domain/stages/types";
import type { Contact } from "@/domain/contacts/types";
import type { ActionResult } from "@/lib/actions";
import type { ActiveBroker } from "@/domain/members/types";
import { Search, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import type { PotentialDuplicate } from "@/domain/contacts/duplicate-detection";
import { DuplicateSuggestionModal } from "@/components/domain/contacts/duplicate-suggestion-modal";

// ── Constants ─────────────────────────────────────────────────────────────────

const OPPORTUNITY_TYPES = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
] as const;

type ConvertResult = ActionResult<{
  opportunityId: string;
  contactId: string | null;
} | { duplicates: PotentialDuplicate[] }>;

const INITIAL_STATE: ConvertResult = { success: false, error: "" };

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConvertInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: Inquiry;
  stages: Stage[];
  contacts: Contact[];
  brokers: ActiveBroker[];
  convertAction: (
    id: string,
    prevState: ActionResult,
    formData: FormData
  ) => Promise<ConvertResult>;
  onSuccess?: (opportunityId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConvertInquiryDialog({
  open,
  onOpenChange,
  inquiry,
  stages,
  contacts,
  brokers,
  convertAction,
  onSuccess,
}: ConvertInquiryDialogProps) {
  // Bind the inquiry id into the action to match (prevState, formData) signature
  const boundAction = convertAction.bind(null, inquiry.id);
  const [state, formAction, pending] = useActionState(
    boundAction as (
      prevState: ConvertResult,
      formData: FormData
    ) => Promise<ConvertResult>,
    INITIAL_STATE
  );
  
  const formRef = useRef<HTMLFormElement>(null);
  const [suggestedDuplicates, setSuggestedDuplicates] = useState<PotentialDuplicate[]>([]);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  // Contact tab: "new" | "existing"
  const [contactTab, setContactTab] = useState<"new" | "existing">("new");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  // New contact fields
  const [newContactType, setNewContactType] = useState<"person" | "organization">("person");
  const [newFirstName, setNewFirstName] = useState(
    inquiry.caller_name?.split(" ")[0] ?? ""
  );
  const [newLastName, setNewLastName] = useState(
    inquiry.caller_name?.split(" ").slice(1).join(" ") ?? ""
  );

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

  // Filtered contacts for search
  const filteredContacts = contacts.filter((c) =>
    c.display_name.toLowerCase().includes(contactSearch.toLowerCase())
  );

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
      formAction(formData);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Convert to opportunity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1" ref={formRef}>
          {/* ── Contact section ───────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Contact</Label>

            {/* Manual tab switcher (no tabs component available) */}
            <div className="flex rounded-lg border p-0.5 bg-muted/40 gap-0.5">
              <button
                type="button"
                onClick={() => setContactTab("new")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  contactTab === "new"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                id="convert-tab-new"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create new
              </button>
              <button
                type="button"
                onClick={() => setContactTab("existing")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  contactTab === "existing"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                id="convert-tab-existing"
              >
                <Users className="h-3.5 w-3.5" />
                Link existing
              </button>
            </div>

            {/* New contact panel */}
            {contactTab === "new" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="new-contact-type">Contact type</Label>
                  <Select
                    value={newContactType}
                    onValueChange={(v: string | null) =>
                      setNewContactType((v ?? "person") as "person" | "organization")
                    }
                  >
                    <SelectTrigger id="new-contact-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">Person</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newContactType === "person" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-first-name">First name</Label>
                      <Input
                        id="new-first-name"
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        placeholder="First name"
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-last-name">Last name</Label>
                      <Input
                        id="new-last-name"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        placeholder="Last name"
                        maxLength={100}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="new-company-name">Company name</Label>
                    <Input
                      id="new-company-name"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="e.g. ACME Real Estate Ltd."
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
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search contacts…"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    id="convert-contact-search"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                  {filteredContacts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No contacts found
                    </p>
                  ) : (
                    filteredContacts.slice(0, 20).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedContactId(c.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                          selectedContactId === c.id &&
                            "bg-primary/10 font-medium"
                        )}
                        id={`contact-option-${c.id}`}
                      >
                        {c.display_name}
                      </button>
                    ))
                  )}
                </div>

                <input
                  type="hidden"
                  name="contact_id"
                  value={selectedContactId}
                />

                {!state.success && state.fieldErrors?.contact_id && (
                  <p className="text-xs text-destructive">
                    {state.fieldErrors.contact_id[0]}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Opportunity details ───────────────────────────────────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Opportunity</Label>

            <div className="space-y-1.5">
              <Label htmlFor="opp-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="opp-title"
                name="opportunity_title"
                defaultValue={defaultTitle}
                maxLength={300}
                placeholder="e.g. Ivan – Buyer – 2-bed Lozenets"
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
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select name="opportunity_type" defaultValue="buyer">
                  <SelectTrigger id="opp-type">
                    <SelectValue>
                      {(val) => OPPORTUNITY_TYPES.find((t) => t.value === val)?.label ?? "Select type"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
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
                  Stage <span className="text-destructive">*</span>
                </Label>
                <Select name="stage_id" defaultValue={defaultStageId}>
                  <SelectTrigger id="opp-stage">
                    <SelectValue placeholder="Pick stage…">
                      {(val) => stages.find((s) => s.id === val)?.name ?? "Pick stage…"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
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
              <Label htmlFor="convert-assigned-to">Assigned to</Label>
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

          {/* Global error */}
          {!state.success && state.error && !state.fieldErrors && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          
          <input type="hidden" name="skipDuplicateCheck" value={skipDuplicateCheck ? "true" : "false"} />

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={pending}
              id="convert-inquiry-submit"
            >
              {pending ? "Converting…" : "Convert"}
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
