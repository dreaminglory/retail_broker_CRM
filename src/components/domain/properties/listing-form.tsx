"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Listing, OfferType } from "@/domain/listings/types";
import type { ActionResult } from "@/lib/actions";

type ListingFormProps = {
  /** Pass to change this listing's price. Omit to add a listing. */
  listing?: Listing;
  /** Offer types without an open listing, for a new one (L5). */
  offerTypes?: OfferType[];
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  onSuccess: () => void;
};

const initialState: ActionResult = { success: false, error: "" };

export function ListingForm({ listing, offerTypes = [], action, onSuccess }: ListingFormProps) {
  const t = useTranslations("ListingSection");
  const enums = useTranslations("Enums");
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state, onSuccess]);

  const fieldErrors = !state.success ? state.fieldErrors : undefined;
  const formError = !state.success && state.error && !fieldErrors ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {!listing && (
        <div className="space-y-1.5">
          <Label htmlFor="listing-offer-type">{t("offerType")}</Label>
          <Select name="offer_type" defaultValue={offerTypes[0]}>
            <SelectTrigger id="listing-offer-type" className="w-full">
              <SelectValue>{(value: string) => enums(`offerType.${value}` as never)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {offerTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {enums(`offerType.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="listing-price">{t("priceEur")}</Label>
        <Input
          id="listing-price"
          name="price"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={listing ? String(listing.price) : ""}
          aria-invalid={!!fieldErrors?.price}
          aria-describedby={fieldErrors?.price ? "listing-price-error" : undefined}
        />
        {fieldErrors?.price && (
          <p id="listing-price-error" className="text-xs text-destructive">
            {fieldErrors.price[0]}
          </p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("saving") : listing ? t("savePrice") : t("addListing")}
      </Button>
    </form>
  );
}
