import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { AreaService } from "@/domain/areas/service";
import { MemberRepository } from "@/domain/members/repository";
import { PropertyService } from "@/domain/properties/service";
import { propertyCode } from "@/components/domain/properties/property-labels";
import type { Locale } from "@/i18n/config";
import { EditPropertyClient } from "./edit-property-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("editProperty") };
}

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership || !UUID.test(id)) notFound();
  const supabase = await createSupabaseServer();
  const locale = (await getLocale()) as Locale;
  const property = await new PropertyService(supabase).getDetail(id, membership.agencyId, locale);
  if (!property) notFound();

  const [brokers, activeAreas] = await Promise.all([
    new MemberRepository(supabase).getActiveBrokers(membership.agencyId),
    new AreaService(supabase).listActiveForSettlement(membership.agencyId, property.settlement_id),
  ]);
  // A deactivated area the property still uses stays selectable.
  const areas = [
    ...activeAreas.map(({ id: areaId, name }) => ({ id: areaId, name })),
    ...(property.area && !activeAreas.some((area) => area.id === property.area!.id) ? [property.area] : []),
  ];
  const t = await getTranslations("PropertyForm");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/properties/${id}`}
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {propertyCode(property)}
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t("editTitle", { code: propertyCode(property) })}</h1>
      <EditPropertyClient property={property} areas={areas} brokers={brokers} />
    </div>
  );
}
