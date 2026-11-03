"use client";

import { useCallback, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Listing, ListingStatus, OfferType } from "@/domain/listings/types";
import type { Property } from "@/domain/properties/types";
import {
  isOpenListing,
  listingStatusChanges,
  OFFER_TYPES,
  pricePerSquareMeter,
} from "@/domain/listings/validation";
import {
  changeListingPriceAction,
  createListingAction,
  setListingStatusAction,
} from "@/app/(dashboard)/properties/actions";
import { ListingForm } from "./listing-form";

type ListingSectionProps = {
  property: Pick<Property, "id" | "type" | "area_m2" | "plot_m2" | "status">;
  listings: Listing[];
};

const STATUS_VARIANT: Record<ListingStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  reserved: "secondary",
  closed: "outline",
  withdrawn: "outline",
};

/** Closing and withdrawing are final (rule 4), so they ask first. */
const FINAL: ListingStatus[] = ["closed", "withdrawn"];

export function ListingSection({ property, listings }: ListingSectionProps) {
  const t = useTranslations("ListingSection");
  const enums = useTranslations("Enums");
  const format = useFormatter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [confirming, setConfirming] = useState<{ listing: Listing; status: ListingStatus } | null>(null);
  const [pending, startTransition] = useTransition();
  const closeAdd = useCallback(() => setAdding(false), []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const open = listings.filter((listing) => isOpenListing(listing.status));
  const past = listings.filter((listing) => !isOpenListing(listing.status));
  const freeOfferTypes = OFFER_TYPES.filter((type: OfferType) => !open.some((listing) => listing.offer_type === type));
  const canAdd = property.status === "active" && freeOfferTypes.length > 0;

  const eur = (value: number, fraction = 0) =>
    format.number(Number(value), { style: "currency", currency: "EUR", maximumFractionDigits: fraction });

  function changeStatus(listing: Listing, status: ListingStatus) {
    startTransition(async () => {
      const result = await setListingStatusAction(listing.id, property.id, status);
      if (!result.success) toast.error(result.error);
      setConfirming(null);
    });
  }

  function requestStatus(listing: Listing, status: ListingStatus) {
    if (FINAL.includes(status)) setConfirming({ listing, status });
    else changeStatus(listing, status);
  }

  function row(listing: Listing) {
    const perM2 = pricePerSquareMeter(Number(listing.price), property);
    const readOnly = !isOpenListing(listing.status);
    return (
      <li key={listing.id} className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{enums(`offerType.${listing.offer_type}`)}</span>
            <Badge variant={STATUS_VARIANT[listing.status]}>{enums(`listingStatus.${listing.status}`)}</Badge>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold tabular-nums">
              {listing.offer_type === "rent" ? t("perMonth", { price: eur(listing.price) }) : eur(listing.price)}
            </p>
            {perM2 !== null && (
              <p className="text-xs text-muted-foreground tabular-nums">{t("perSquareMeter", { price: eur(perM2, listing.offer_type === "rent" ? 2 : 0) })}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {readOnly && listing.closed_at
            ? t("listedClosed", {
                listed: format.dateTime(new Date(listing.listed_at), { dateStyle: "medium" }),
                closed: format.dateTime(new Date(listing.closed_at), { dateStyle: "medium" }),
              })
            : t("listedOn", { date: format.dateTime(new Date(listing.listed_at), { dateStyle: "medium" }) })}
        </p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(listing)} disabled={pending}>
              {t("changePrice")}
            </Button>
            {listingStatusChanges(listing.status).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={FINAL.includes(status) ? "ghost" : "outline"}
                onClick={() => requestStatus(listing, status)}
                disabled={pending}
              >
                {t(`to.${status}`)}
              </Button>
            ))}
          </div>
        )}
      </li>
    );
  }

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="property-listings">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="property-listings" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h2>
        {canAdd && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("addListing")}
          </Button>
        )}
      </div>

      {open.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {property.status === "archived" ? t("archivedNoListings") : t("empty")}
        </p>
      ) : (
        <ul className="divide-y">{open.map(row)}</ul>
      )}

      {past.length > 0 && (
        <details className="border-t">
          <summary className="cursor-pointer px-4 py-2 text-sm text-muted-foreground">
            {t("past", { count: past.length })}
          </summary>
          <ul className="divide-y opacity-75">{past.map(row)}</ul>
        </details>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addListing")}</DialogTitle>
          </DialogHeader>
          {adding && (
            <ListingForm
              offerTypes={freeOfferTypes}
              action={createListingAction.bind(null, property.id)}
              onSuccess={closeAdd}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(value) => !value && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("changePrice")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ListingForm
              listing={editing}
              action={changeListingPriceAction.bind(null, editing.id, property.id)}
              onSuccess={closeEdit}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirming} onOpenChange={(value) => !value && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && t(`confirm.${confirming.status}.title`)}</AlertDialogTitle>
            <AlertDialogDescription>{confirming && t(`confirm.${confirming.status}.description`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => confirming && changeStatus(confirming.listing, confirming.status)}
            >
              {confirming && t(`to.${confirming.status}`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
