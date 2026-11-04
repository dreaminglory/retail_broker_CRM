"use client";

import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AuditEvent } from "@/domain/timeline/audit-event";
import type { TimelineAudit } from "@/domain/timeline/types";

type Translator = ReturnType<typeof useTranslations>;

/** A label from `namespace.value` when it exists, else the raw value. */
function label(t: Translator, key: string, fallback: string) {
  return t.has(key as never) ? t(key as never) : fallback;
}

function Change({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{from}</Badge>
      <ArrowRightLeft className="h-3 w-3" aria-hidden />
      <Badge variant="default">{to}</Badge>
    </div>
  );
}

const code = (value: number | null) => (value === null ? "" : `#${value}`);

export function auditEventTitle(t: Translator, event: AuditEvent): string {
  switch (event.kind) {
    case "created":
      return t("events.created");
    case "stage":
      return t("events.stageChanged");
    case "assignment":
      return t("events.assignmentChanged");
    case "opportunityStatus":
      return t("events.statusChanged");
    case "propertyCreated":
      return t("events.propertyCreated", { code: code(event.code) });
    case "propertyStatus":
      return t("events.propertyStatusChanged");
    case "listingCreated":
      return t("events.listingCreated");
    case "listingPrice":
      return t("events.listingPriceChanged");
    case "listingStatus":
      return t("events.listingStatusChanged");
    case "propertyLink":
      if (event.from === null) return t("events.propertyLinkAdded", { code: code(event.code) });
      if (event.to === null) return t("events.propertyLinkRemoved", { code: code(event.code) });
      return t("events.propertyLinkChanged", { code: code(event.code) });
    default:
      return t("events.systemUpdate");
  }
}

/**
 * The body of an audit entry. `showDeal` is set on the property timeline, where a link row
 * names its deal; on the opportunity timeline the row names its property instead.
 */
export function AuditEventBody({ event, data, showDeal }: { event: AuditEvent; data: TimelineAudit; showDeal?: boolean }) {
  const t = useTranslations("Timeline");
  const tEnum = useTranslations("Enums");
  const format = useFormatter();

  // As on the listing card: whole euros for a sale, cents for a monthly rent.
  const price = (value: number | null, offerType: string | null) => {
    if (value === null) return "—";
    const rent = offerType === "rent";
    const eur = format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: rent ? 2 : 0 });
    return rent ? t("perMonth", { price: eur }) : eur;
  };
  const linkStatus = (value: string) =>
    value === "subject" ? t("linkSubject") : label(tEnum, `propertyLinkStatus.${value}`, value);

  switch (event.kind) {
    case "stage":
      return <Change from={event.from} to={event.to} />;
    case "assignment":
      return <Change from={event.from ?? t("unassigned")} to={event.to ?? t("unassigned")} />;
    case "opportunityStatus":
      return (
        <Change
          from={label(tEnum, `opportunityStatus.${event.from}`, event.from ?? "")}
          to={label(tEnum, `opportunityStatus.${event.to}`, event.to ?? "")}
        />
      );
    case "created":
      return (
        <div className="text-sm">
          {event.imported ? (
            <span>
              {t("importedFrom")} <strong>{event.importFile ?? t("csvFile")}</strong>
            </span>
          ) : (
            <span>{t("manuallyCreated")}</span>
          )}
        </div>
      );
    case "propertyStatus":
      return (
        <Change
          from={label(t, `propertyStatus.${event.from}`, event.from ?? "")}
          to={label(t, `propertyStatus.${event.to}`, event.to ?? "")}
        />
      );
    case "listingCreated":
      return (
        <div className="flex flex-wrap items-center gap-2">
          {event.offerType && <Badge variant="outline">{label(tEnum, `offerType.${event.offerType}`, event.offerType)}</Badge>}
          <span className="font-medium tabular-nums text-foreground">{price(event.price, event.offerType)}</span>
        </div>
      );
    case "listingPrice":
      return (
        <div className="tabular-nums">
          <Change from={price(event.from, event.offerType)} to={price(event.to, event.offerType)} />
        </div>
      );
    case "listingStatus":
      return (
        <Change
          from={label(tEnum, `listingStatus.${event.from}`, event.from ?? "")}
          to={label(tEnum, `listingStatus.${event.to}`, event.to ?? "")}
        />
      );
    case "propertyLink":
      return (
        <div className="space-y-1">
          {showDeal
            ? data.opportunity && (
                <Link href={`/opportunities/${data.opportunity.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                  {t("onDeal", { title: data.opportunity.title })}
                </Link>
              )
            : event.propertyId && (
                <Link href={`/properties/${event.propertyId}`} className="font-mono text-foreground underline-offset-2 hover:underline">
                  {code(event.code)}
                </Link>
              )}
          {event.from !== null && event.to !== null ? (
            <Change from={linkStatus(event.from)} to={linkStatus(event.to)} />
          ) : (
            <div>
              <Badge variant="outline">{linkStatus(event.from ?? event.to ?? "")}</Badge>
            </div>
          )}
          {event.reason && <p className="text-sm italic">{t("rejectedReason", { reason: event.reason })}</p>}
        </div>
      );
    default:
      return null;
  }
}
