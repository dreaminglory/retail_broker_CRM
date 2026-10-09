"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ContactMethod } from "@/domain/contacts/types";
import {
  addContactMethodAction,
  removeContactMethodAction,
  setPrimaryContactMethodAction,
} from "@/app/(dashboard)/contacts/actions";
import {
  Phone,
  Mail,
  MessageCircle,
  Star,
  Trash2,
  Plus,
} from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { useTranslations } from "next-intl";

interface ContactMethodListProps {
  contactId: string;
  methods: ContactMethod[];
}

const METHOD_TYPE_LABELS: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  viber: "Viber",
  whatsapp: "WhatsApp",
  other: "Other",
};

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  email: Mail,
  viber: MessageCircle,
  whatsapp: MessageCircle,
  other: Phone,
};

type AddMethodResult = ActionResult<{ id: string }>;
const addInitialState: AddMethodResult = { success: false, error: "" };

export function ContactMethodList({
  contactId,
  methods,
}: ContactMethodListProps) {
  const t = useTranslations("ContactMethodList");
  const [addOpen, setAddOpen] = useState(false);


  return (
    <div className="space-y-3">
      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {t("emptyState")}
        </p>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <MethodRow
              key={method.id}
              method={method}
              contactId={contactId}
            />
          ))}
        </div>
      )}

      {/* Add method */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t("addMethod")}
            </Button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addMethod")}</DialogTitle>
          </DialogHeader>
          <AddMethodForm
            contactId={contactId}
            onSuccess={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MethodRow({
  method,
  contactId,
}: {
  method: ContactMethod;
  contactId: string;
}) {
  const t = useTranslations("ContactMethodList");
  const tEnum = useTranslations("Enums");
  const [removing, setRemoving] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const Icon = METHOD_ICONS[method.type] ?? Phone;

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeContactMethodAction(method.id, contactId);
    } finally {
      setRemoving(false);
    }
  }

  async function handleSetPrimary() {
    setSettingPrimary(true);
    try {
      await setPrimaryContactMethodAction(method.id, contactId);
    } finally {
      setSettingPrimary(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{method.value}</p>
        <p className="text-xs text-muted-foreground">
          {tEnum(`contactMethod.${method.type}` as any) ?? method.type}
          {method.label ? ` · ${method.label}` : ""}
        </p>
      </div>
      {method.is_primary && (
        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 gap-0.5">
          <Star className="h-2.5 w-2.5" />
          {t("primary")}
        </Badge>
      )}
      <div className="flex items-center gap-1">
        {!method.is_primary && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={handleSetPrimary}
            disabled={settingPrimary}
            title={t("setPrimary")}
          >
            <Star className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
          disabled={removing}
          aria-label={t("removeMethod")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function AddMethodForm({
  contactId,
  onSuccess,
}: {
  contactId: string;
  onSuccess: () => void;
}) {
  const t = useTranslations("ContactMethodList");
  const tEnum = useTranslations("Enums");
  const [selectedType, setSelectedType] = useState<string>("phone");

  const boundAction = addContactMethodAction.bind(null, contactId) as (
    prevState: AddMethodResult,
    formData: FormData
  ) => Promise<AddMethodResult>;
  const [state, formAction, pending] = useActionState(boundAction, addInitialState);
  const fieldErrors = !state.success ? state.fieldErrors : undefined;

  if (state.success) {
    onSuccess();
  }

  const Icon = METHOD_ICONS[selectedType] ?? Phone;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="method-type">{t("fields.type.label")}</Label>
        <Select name="type" value={selectedType} onValueChange={(val) => val && setSelectedType(val as string)}>
          <SelectTrigger id="method-type">
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="method-value">
          {t("fields.value.label")} <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Icon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="method-value"
            name="value"
            className="pl-8"
            placeholder={
              selectedType === "email"
                ? "email@example.com"
                : selectedType === "phone" ||
                  selectedType === "viber" ||
                  selectedType === "whatsapp"
                ? "+359 888 123 456"
                : "Value"
            }
            required
            aria-invalid={!!fieldErrors?.value}
          />
        </div>
        {fieldErrors?.value && (
          <p className="text-xs text-destructive">{fieldErrors.value[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="method-label">{t("fields.label.label")}</Label>
        <Input
          id="method-label"
          name="label"
          placeholder={t("fields.label.placeholder")}
          maxLength={50}
        />
      </div>

      {!state.success && state.error && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("adding") : t("addMethod")}
      </Button>
    </form>
  );
}
