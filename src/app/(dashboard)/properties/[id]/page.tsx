import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { Badge } from "@/components/ui/badge";
import { PropertyService } from "@/domain/properties/service";
import type { PropertyDetail } from "@/domain/properties/types";
import { propertyCode, propertyHeadline } from "@/components/domain/properties/property-labels";
import { ListingSection } from "@/components/domain/properties/listing-section";
import { ListingService } from "@/domain/listings/service";
import { PartySection } from "@/components/domain/properties/party-section";
import { PropertyActionsMenu } from "@/components/domain/properties/property-actions-menu";
import { CONFIG_ROLES, hasRole } from "@/lib/roles";
import { PropertyPartyService } from "@/domain/property-parties/service";
import { OpportunityPropertyService } from "@/domain/opportunity-properties/service";
import { PropertyOpportunities } from "@/components/domain/properties/property-opportunities";
import { ScheduleViewingButton } from "@/components/domain/properties/schedule-viewing-button";
import { MemberRepository } from "@/domain/members/repository";
import type { Locale } from "@/i18n/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

async function loadProperty(id: string): Promise<PropertyDetail | null> {
  if (!UUID.test(id)) return null;
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const supabase = await createSupabaseServer();
  const locale = (await getLocale()) as Locale;
  return new PropertyService(supabase).getDetail(id, membership.agencyId, locale);
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations("Metadata");
  const property = await loadProperty((await params).id);
  return { title: property ? t("property", { code: propertyCode(property) }) : t("properties") };
}

export default async function PropertyPage({ params }: Props) {
  const property = await loadProperty((await params).id);
  if (!property) notFound();

  const supabase = await createSupabaseServer();
  const membership = await getCurrentMembership();
  const [listings, parties, opportunityLinks, brokers] = await Promise.all([
    new ListingService(supabase).listForProperty(property.id, property.agency_id),
    new PropertyPartyService(supabase).listForProperty(property.id, property.agency_id),
    new OpportunityPropertyService(supabase).listForProperty(property.id, property.agency_id),
    new MemberRepository(supabase).getActiveBrokers(property.agency_id),
  ]);
  // A viewing is scheduled on an active deal this property is a candidate on (rule 8: not when archived).
  const viewingDeals = opportunityLinks
    .filter((link) => link.relation === "candidate" && link.opportunity.status === "active")
    .map((link) => ({ id: link.opportunity.id, title: link.opportunity.title }));

  const t = await getTranslations("PropertyDetail");
  const enums = await getTranslations("Enums");
  const format = await getFormatter();
  const headline = propertyHeadline(enums, property);
  const place = [property.area?.name, property.settlement.name].filter(Boolean).join(", ");
  const m2 = (value: number) => t("squareMeters", { value: format.number(Number(value), { maximumFractionDigits: 2 }) });

  const attributes: { label: string; value: string }[] = [
    { label: t("type"), value: enums(`propertyType.${property.type}`) },
    ...(property.rooms ? [{ label: t("rooms"), value: String(property.rooms) }] : []),
    ...(property.area_m2 ? [{ label: t("areaM2"), value: m2(property.area_m2) }] : []),
    ...(property.plot_m2 ? [{ label: t("plotM2"), value: m2(property.plot_m2) }] : []),
    ...(property.floor !== null
      ? [{
          label: t("floor"),
          value: property.floors_total
            ? t("floorOfTotal", { floor: property.floor, total: property.floors_total })
            : String(property.floor),
        }]
      : property.floors_total
        ? [{ label: t("floorsTotal"), value: String(property.floors_total) }]
        : []),
    ...(property.construction ? [{ label: t("construction"), value: enums(`construction.${property.construction}`) }] : []),
    ...(property.year_built ? [{ label: t("yearBuilt"), value: String(property.year_built) }] : []),
  ];

  const location: { label: string; value: string }[] = [
    { label: t("settlement"), value: t("settlementWithProvince", { name: property.settlement.name, province: property.settlement.province }) },
    { label: t("area"), value: property.area?.name ?? t("none") },
    ...(property.address ? [{ label: t("address"), value: property.address }] : []),
    ...(property.location_note ? [{ label: t("locationNote"), value: property.location_note }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/properties"
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {t("backToList")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {propertyCode(property)}
            </Badge>
            {property.status === "archived" && <Badge variant="secondary">{t("archived")}</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title", { headline, place })}</h1>
          {property.address && <p className="text-sm text-muted-foreground">{property.address}</p>}
        </div>
        <PropertyActionsMenu
          propertyId={property.id}
          status={property.status}
          canDelete={hasRole(membership?.role, CONFIG_ROLES)}
        />
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <DetailCard title={t("attributes")} rows={attributes} />
        <DetailCard title={t("location")} rows={location} />
      </div>

      <ListingSection property={property} listings={listings} />

      <PartySection propertyId={property.id} current={parties.current} past={parties.past} />

      <PropertyOpportunities
        links={opportunityLinks}
        action={
          property.status === "active" ? (
            <ScheduleViewingButton
              propertyId={property.id}
              code={propertyCode(property)}
              deals={viewingDeals}
              brokers={brokers}
            />
          ) : undefined
        }
      />

      <section className="rounded-lg border bg-card p-4" aria-labelledby="property-work">
        <h2 id="property-work" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("work")}
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("assignedTo")}</dt>
            <dd className="font-medium">{property.assignee?.display_name ?? t("unassigned")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("createdAt")}</dt>
            <dd>{format.dateTime(new Date(property.created_at), { dateStyle: "medium" })}</dd>
          </div>
        </dl>
        {property.description && (
          <p className="mt-4 whitespace-pre-line text-sm">{property.description}</p>
        )}
      </section>
    </div>
  );
}

function DetailCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
