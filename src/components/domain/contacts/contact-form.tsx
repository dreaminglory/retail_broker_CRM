"use client";

import { useTranslations } from "next-intl";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import type { Contact } from "@/domain/contacts/types";
import type { ActionResult } from "@/lib/actions";
import { Plus, X, Phone, Mail, MessageCircle } from "lucide-react";
import type { PotentialDuplicate } from "@/domain/contacts/duplicate-detection";
import { DuplicateSuggestionModal } from "./duplicate-suggestion-modal";

interface ContactMethod {
  type: "phone" | "email" | "viber" | "whatsapp" | "other";
  value: string;
  label: string;
  is_primary: boolean;
}

interface ContactFormProps {
  contact?: Contact;
  createAction: (prevState: any, formData: FormData) => Promise<ActionResult<any>>;
  updateAction?: (prevState: any, formData: FormData) => Promise<ActionResult>;
  onSuccess?: (id?: string) => void;
}

const METHOD_TYPE_LABELS = {
  phone: "Phone",
  email: "Email",
  viber: "Viber",
  whatsapp: "WhatsApp",
  other: "Other",
};

const METHOD_ICONS = {
  phone: Phone,
  email: Mail,
  viber: MessageCircle,
  whatsapp: MessageCircle,
  other: Phone,
};

const initialState: ActionResult<unknown> = { success: false, error: "" };

export function ContactForm({
  contact,
  createAction,
  updateAction,
  onSuccess,
}: ContactFormProps) {
  const t = useTranslations("ContactForm");
  const tEnum = useTranslations("Enums");
  const isEdit = !!contact;
  const action = isEdit && updateAction ? updateAction : createAction;

  const [state, formAction, pending] = useActionState(
    action as (prevState: ActionResult<unknown>, formData: FormData) => Promise<ActionResult<unknown>>,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [contactType, setContactType] = useState<"person" | "organization">(
    contact?.type ?? "person"
  );
  const [methods, setMethods] = useState<ContactMethod[]>([
    { type: "phone", value: "", label: "", is_primary: true },
  ]);
  const [resetKey, setResetKey] = useState(0);
  const onSuccessRef = useRef(onSuccess);

  const [suggestedDuplicates, setSuggestedDuplicates] = useState<PotentialDuplicate[]>([]);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (state.success) {
      const data = state.data as Record<string, any> | undefined;
      if (data && typeof data === 'object' && 'duplicates' in data && Array.isArray(data.duplicates)) {
        const duplicates = data.duplicates;
        setTimeout(() => setSuggestedDuplicates(duplicates), 0);
      } else {
        const successId = data && typeof data === 'object' && 'id' in data ? (data.id as string) : undefined;
        if (!isEdit) {
          formRef.current?.reset();
          setTimeout(() => {
            setResetKey((k) => k + 1);
            setSkipDuplicateCheck(false);
            setSuggestedDuplicates([]);
          }, 0);
        }
        onSuccessRef.current?.(successId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isEdit]);

  const fieldErrors = !state.success ? state.fieldErrors : undefined;

  function addMethod() {
    setMethods((prev) => [
      ...prev,
      { type: "phone", value: "", label: "", is_primary: false },
    ]);
  }

  function removeMethod(index: number) {
    setMethods((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMethod(index: number, patch: Partial<ContactMethod>) {
    setMethods((prev) =>
      prev.map((m, i) => {
        if (i !== index) {
          // If setting this as primary, clear others
          if (patch.is_primary) return { ...m, is_primary: false };
          return m;
        }
        return { ...m, ...patch };
      })
    );
  }

  // Serialize methods as JSON for the hidden input
  const methodsJson = JSON.stringify(
    methods.filter((m) => m.value.trim() !== "")
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {/* Contact type — key resets controlled state after successful create */}
      <div key={resetKey} className="space-y-1.5">
        <Label htmlFor="contact-type">
          Type <span className="text-destructive">*</span>
        </Label>
        <Select
          name="type"
          value={contactType}
          onValueChange={(v) => setContactType((v ?? "person") as "person" | "organization")}
          required
        >
          <SelectTrigger id="contact-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="person">{t("fields.type.person")}</SelectItem>
            <SelectItem value="organization">{t("fields.type.organization")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Person fields */}
      {contactType === "person" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="first-name">{t("fields.firstName.label")}</Label>
            <Input
              id="first-name"
              name="first_name"
              defaultValue={contact?.first_name ?? ""}
              maxLength={100}
              placeholder={t("fields.firstName.placeholder")}
              aria-invalid={!!fieldErrors?.first_name}
            />
            {fieldErrors?.first_name && (
              <p className="text-xs text-destructive">{fieldErrors.first_name[0]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last-name">{t("fields.lastName.label")}</Label>
            <Input
              id="last-name"
              name="last_name"
              defaultValue={contact?.last_name ?? ""}
              maxLength={100}
              placeholder={t("fields.lastName.placeholder")}
            />
          </div>
        </div>
      )}

      {/* Organization field */}
      {contactType === "organization" && (
        <div className="space-y-1.5">
          <Label htmlFor="company-name">
            Company name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company-name"
            name="company_name"
            defaultValue={contact?.company_name ?? ""}
            maxLength={200}
            placeholder={t("fields.companyName.placeholder")}
            required
            aria-invalid={!!fieldErrors?.company_name}
          />
          {fieldErrors?.company_name && (
            <p className="text-xs text-destructive">{fieldErrors.company_name[0]}</p>
          )}
        </div>
      )}

      {/* Optional company affiliation for persons */}
      {contactType === "person" && (
        <div className="space-y-1.5">
          <Label htmlFor="company-affiliation">{t("fields.companyOptional.label")}</Label>
          <Input
            id="company-affiliation"
            name="company_name"
            defaultValue={contact?.company_name ?? ""}
            maxLength={200}
            placeholder={t("fields.companyOptional.placeholder")}
          />
        </div>
      )}

      {/* Contact methods — only shown for create mode */}
      {!isEdit && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t("methodsTitle")}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addMethod}
              className="h-7 px-2 text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>

          {methods.map((method, idx) => {
            const Icon = METHOD_ICONS[method.type];
            return (
              <div key={idx} className="flex items-start gap-2">
                {/* Type select */}
                <Select
                  value={method.type}
                  onValueChange={(v) =>
                    updateMethod(idx, { type: v as ContactMethod["type"] })
                  }
                >
                  <SelectTrigger className="w-32 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["phone", "email", "viber", "whatsapp", "other"].map((val) => (
                      <SelectItem key={val} value={val}>
                        {tEnum(`contactMethod.${val}` as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value input */}
                <div className="relative flex-1">
                  <Icon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder={
                      method.type === "email"
                        ? "email@example.com"
                        : method.type === "phone" ||
                          method.type === "viber" ||
                          method.type === "whatsapp"
                        ? "+359 888 123 456"
                        : "Value"
                    }
                    value={method.value}
                    onChange={(e) => updateMethod(idx, { value: e.target.value })}
                  />
                </div>

                {/* {t("primary")} badge + remove */}
                <div className="flex items-center gap-1 pt-1">
                  {method.is_primary ? (
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-[10px] px-1.5"
                    >
                      Primary
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] text-muted-foreground"
                      onClick={() => updateMethod(idx, { is_primary: true })}
                    >
                      {t("setPrimary")}
                    </Button>
                  )}
                  {methods.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMethod(idx)}
                      aria-label={t("removeMethod")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Hidden field carries the serialized methods */}
          <input type="hidden" name="contact_methods" value={methodsJson} />
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("fields.notes.label")}</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={contact?.notes ?? ""}
          maxLength={5000}
          placeholder="Any relevant notes about this contact…"
          rows={3}
        />
      </div>

      {/* Global error */}
      {!state.success && state.error && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <input type="hidden" name="skipDuplicateCheck" value={skipDuplicateCheck ? "true" : "false"} />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("saving") : isEdit ? t("saveChanges") : t("createContact")}
      </Button>

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
    </form>
  );
}
