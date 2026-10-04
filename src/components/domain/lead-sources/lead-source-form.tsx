"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadSource, Channel } from "@/domain/lead-sources/types";
import { CHANNELS } from "@/domain/lead-sources/validation";
import type { ActionResult } from "@/lib/actions";

const CHANNEL_LABELS: Record<Channel, string> = {
  portal: "Property Portal",
  referral: "Referral",
  website: "Agency Website",
  phone: "Phone Call",
  social: "Social Media",
  email: "Email",
  walk_in: "Walk-in",
  other: "Other",
};

interface LeadSourceFormProps {
  /** Pass when editing an existing lead source. Omit for create mode. */
  leadSource?: LeadSource;
  createAction: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  updateAction?: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  onSuccess?: () => void;
}

const initialState: ActionResult = { success: false, error: "" };

export function LeadSourceForm({
  leadSource,
  createAction,
  updateAction,
  onSuccess,
}: LeadSourceFormProps) {
  const isEdit = !!leadSource;
  const action = isEdit && updateAction ? updateAction : createAction;

  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      if (!isEdit) {
        formRef.current?.reset();
      }
      onSuccess?.();
    }
  }, [state.success, isEdit, onSuccess]);

  const fieldErrors = !state.success ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="ls-name">
          Source name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ls-name"
          name="name"
          placeholder="e.g. Imot.bg"
          defaultValue={leadSource?.name ?? ""}
          required
          maxLength={100}
          aria-invalid={!!fieldErrors?.name}
          aria-describedby={fieldErrors?.name ? "ls-name-error" : undefined}
        />
        {fieldErrors?.name && (
          <p id="ls-name-error" className="text-xs text-destructive">
            {fieldErrors.name[0]}
          </p>
        )}
      </div>

      {/* Channel */}
      <div className="space-y-1.5">
        <Label htmlFor="ls-channel">
          Channel <span className="text-destructive">*</span>
        </Label>
        <Select name="channel" defaultValue={leadSource?.channel ?? "other"} required>
          <SelectTrigger id="ls-channel" aria-invalid={!!fieldErrors?.channel}>
            <SelectValue placeholder="Select a channel" />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((ch) => (
              <SelectItem key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors?.channel && (
          <p className="text-xs text-destructive">{fieldErrors.channel[0]}</p>
        )}
      </div>

      {/* Global error */}
      {!state.success && state.error && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : isEdit ? "Save changes" : "Add lead source"}
      </Button>
    </form>
  );
}
