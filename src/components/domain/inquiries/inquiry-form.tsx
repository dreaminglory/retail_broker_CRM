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
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Inquiry } from "@/domain/inquiries/types";
import type { ActiveBroker } from "@/domain/members/types";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import type { ActionResult } from "@/lib/actions";

// ── Props ────────────────────────────────────────────────────────────────────

interface InquiryFormProps {
  /** Server action — prevState is ActionResult (base), returns ActionResult<{id}> */
  createAction: (
    prevState: ActionResult,
    formData: FormData
  ) => Promise<ActionResult<{ id: string }>>;
  /** If provided, the form operates in edit mode */
  inquiry?: Inquiry;
  /** Active lead sources for the source selector */
  leadSources: LeadSource[];
  /** Active brokers for the assignment selector */
  brokers: ActiveBroker[];
  /** Called when the action completes successfully */
  onSuccess?: (id?: string) => void;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: ActionResult<{ id: string }> = {
  success: false,
  error: "",
};

// ── Component ────────────────────────────────────────────────────────────────

export function InquiryForm({
  createAction,
  inquiry,
  leadSources,
  brokers,
  onSuccess,
}: InquiryFormProps) {
  const [state, formAction, pending] = useActionState(
    createAction as (
      prevState: ActionResult<{ id: string }>,
      formData: FormData
    ) => Promise<ActionResult<{ id: string }>>,
    INITIAL_STATE
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);

  // On success: reset form + notify parent
  useEffect(() => {
    if (!state.success) return;
    const id = state.data.id;
    setTimeout(() => setResetKey((k) => k + 1), 0);
    formRef.current?.reset();
    onSuccess?.(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Source */}
      <div key={`src-${resetKey}`} className="space-y-1.5">
        <Label htmlFor="inquiry-source">Lead source</Label>
        <Select name="source_id" defaultValue={inquiry?.source_id ?? ""}>
          <SelectTrigger id="inquiry-source">
            <SelectValue placeholder="Select a source…">
              {(val) => leadSources.find((s) => s.id === val)?.name ?? "Select a source…"}
            </SelectValue>          </SelectTrigger>
          <SelectContent>
            {leadSources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!state.success && state.fieldErrors?.source_id && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.source_id[0]}
          </p>
        )}
      </div>

      {/* Assigned To */}
      <div key={`assign-${resetKey}`} className="space-y-1.5">
        <Label htmlFor="assigned-to">Assigned to</Label>
        <BrokerSelect
          name="assigned_to"
          brokers={brokers}
          defaultValue={inquiry?.assigned_to ?? null}
        />
        {!state.success && state.fieldErrors?.assigned_to && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.assigned_to[0]}
          </p>
        )}
      </div>

      {/* Caller name */}
      <div className="space-y-1.5">
        <Label htmlFor="caller-name">Caller name</Label>
        <Input
          id="caller-name"
          name="caller_name"
          defaultValue={inquiry?.caller_name ?? ""}
          maxLength={200}
          placeholder="e.g. Ivan Petrov"
          aria-invalid={
            !state.success && !!state.fieldErrors?.caller_name
          }
        />
        {!state.success && state.fieldErrors?.caller_name && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.caller_name[0]}
          </p>
        )}
      </div>

      {/* Caller phone + email side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="caller-phone">Phone</Label>
          <Input
            id="caller-phone"
            name="caller_phone"
            type="tel"
            defaultValue={inquiry?.caller_phone ?? ""}
            maxLength={50}
            placeholder="+359 888 …"
          />
          {!state.success && state.fieldErrors?.caller_phone && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.caller_phone[0]}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caller-email">Email</Label>
          <Input
            id="caller-email"
            name="caller_email"
            type="email"
            defaultValue={inquiry?.caller_email ?? ""}
            maxLength={254}
            placeholder="name@example.com"
          />
          {!state.success && state.fieldErrors?.caller_email && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.caller_email[0]}
            </p>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="inquiry-subject">Subject</Label>
        <Input
          id="inquiry-subject"
          name="subject"
          defaultValue={inquiry?.subject ?? ""}
          maxLength={500}
          placeholder="e.g. Looking for 2-bed apartment in Lozenets"
          aria-invalid={!state.success && !!state.fieldErrors?.subject}
        />
        {!state.success && state.fieldErrors?.subject && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.subject[0]}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="inquiry-description">Description (optional)</Label>
        <Textarea
          id="inquiry-description"
          name="description"
          defaultValue={inquiry?.description ?? ""}
          maxLength={5000}
          placeholder="Any additional details about the inquiry…"
          rows={3}
        />
      </div>

      {/* External ref */}
      <div className="space-y-1.5">
        <Label htmlFor="inquiry-external-ref">External ref (optional)</Label>
        <Input
          id="inquiry-external-ref"
          name="external_ref"
          defaultValue={inquiry?.external_ref ?? ""}
          maxLength={200}
          placeholder="Portal ID or tracking number"
        />
      </div>

      {/* Global error */}
      {!state.success && state.error && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log inquiry"}
      </Button>
    </form>
  );
}
