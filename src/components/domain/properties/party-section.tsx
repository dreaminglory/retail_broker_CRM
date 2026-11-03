"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactCombobox } from "@/components/domain/contacts/contact-combobox";
import { ContactForm } from "@/components/domain/contacts/contact-form";
import { createContactAction } from "@/app/(dashboard)/contacts/actions";
import { addPropertyPartyAction, endPropertyPartyAction } from "@/app/(dashboard)/properties/actions";
import type { PartyRole, PropertyPartyWithContact } from "@/domain/property-parties/types";
import { PARTY_ROLES } from "@/domain/property-parties/validation";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";

type PartySectionProps = {
  propertyId: string;
  current: PropertyPartyWithContact[];
  past: PropertyPartyWithContact[];
};

const initialState: ActionResult = { success: false, error: "" };

export function PartySection({ propertyId, current, past }: PartySectionProps) {
  const t = useTranslations("PartySection");
  const enums = useTranslations("Enums");
  const format = useFormatter();
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function end(party: PropertyPartyWithContact) {
    startTransition(async () => {
      const result = await endPropertyPartyAction(party.id, propertyId);
      if (!result.success) toast.error(result.error);
    });
  }

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="property-parties">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="property-parties" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t("addParty")}
        </Button>
      </div>

      {current.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y">
          {current.map((party) => (
            <li key={party.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link href={`/contacts/${party.contact.id}`} className="truncate text-sm font-medium hover:underline">
                  {party.contact.display_name}
                </Link>
                <Badge variant="secondary">{enums(`partyRole.${party.role}`)}</Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => end(party)}
                aria-label={t("endParty", { name: party.contact.display_name })}
              >
                {t("end")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <details className="border-t">
          <summary className="cursor-pointer px-4 py-2 text-sm text-muted-foreground">
            {t("past", { count: past.length })}
          </summary>
          <ul className="divide-y opacity-75">
            {past.map((party) => (
              <li key={party.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/contacts/${party.contact.id}`} className="hover:underline">
                    {party.contact.display_name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{enums(`partyRole.${party.role}`)}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("endedOn", { date: format.dateTime(new Date(party.ended_at!), { dateStyle: "medium" }) })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addParty")}</DialogTitle>
          </DialogHeader>
          {adding && <AddPartyForm propertyId={propertyId} onDone={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Pick an existing contact, or create one with the contact form (its duplicate check included). */
function AddPartyForm({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const t = useTranslations("PartySection");
  const enums = useTranslations("Enums");
  const [role, setRole] = useState<PartyRole>("owner");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const action = addPropertyPartyAction.bind(null, propertyId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startAdding] = useTransition();

  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);

  function addCreatedContact(contactId?: string) {
    if (!contactId) return;
    startAdding(async () => {
      const formData = new FormData();
      formData.set("contact_id", contactId);
      formData.set("role", role);
      const result = await action(initialState, formData);
      if (result.success) onDone();
      else toast.error(result.error);
    });
  }

  const contactError = !state.success ? state.fieldErrors?.contact_id?.[0] : undefined;
  const formError = !state.success && state.error && !state.fieldErrors ? state.error : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="party-role">{t("role")}</Label>
        <Select value={role} onValueChange={(value) => setRole(value as PartyRole)}>
          <SelectTrigger id="party-role" className="w-full">
            <SelectValue>{(value: string) => enums(`partyRole.${value}` as never)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PARTY_ROLES.map((value) => (
              <SelectItem key={value} value={value}>
                {enums(`partyRole.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["existing", "new"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              mode === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(value === "existing" ? "existingContact" : "newContact")}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="role" value={role} />
          <div className="space-y-1.5">
            <Label htmlFor="party-contact">{t("contact")}</Label>
            <ContactCombobox id="party-contact" name="contact_id" required invalid={!!contactError} />
            {contactError && <p className="text-xs text-destructive">{contactError}</p>}
          </div>
          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? t("saving") : t("addParty")}
          </Button>
        </form>
      ) : (
        <ContactForm createAction={createContactAction} onSuccess={addCreatedContact} />
      )}
    </div>
  );
}
