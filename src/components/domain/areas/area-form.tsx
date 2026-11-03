"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Area } from "@/domain/areas/types";
import type { ActionResult } from "@/lib/actions";

type AreaFormProps = {
  settlementId: string;
  /** Pass when renaming. Omit to add an area. */
  area?: Area;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  onSuccess?: () => void;
};

const initialState: ActionResult = { success: false, error: "" };

export function AreaForm({ settlementId, area, action, onSuccess }: AreaFormProps) {
  const t = useTranslations("SettingsAreas.form");
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = !!area;
  const inputId = isEdit ? `area-name-${area.id}` : "area-name-new";

  useEffect(() => {
    if (!state.success) return;
    if (!isEdit) formRef.current?.reset();
    onSuccess?.();
  }, [state, isEdit, onSuccess]);

  const nameError = !state.success ? state.fieldErrors?.name?.[0] : undefined;
  const formError = !state.success && state.error && !state.fieldErrors ? state.error : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="settlement_id" value={settlementId} />
      <Label htmlFor={inputId} className={isEdit ? undefined : "sr-only"}>
        {t("name")}
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          name="name"
          defaultValue={area?.name ?? ""}
          placeholder={t("namePlaceholder")}
          required
          maxLength={100}
          aria-invalid={!!nameError || !!formError}
          aria-describedby={nameError || formError ? `${inputId}-error` : undefined}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? t("saving") : isEdit ? t("save") : t("add")}
        </Button>
      </div>
      {(nameError || formError) && (
        <p id={`${inputId}-error`} className="text-xs text-destructive" role="alert">
          {nameError ?? formError}
        </p>
      )}
    </form>
  );
}
