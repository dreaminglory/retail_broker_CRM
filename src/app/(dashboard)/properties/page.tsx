import Link from "next/link";
import { Plus } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { buttonVariants } from "@/components/ui/button";
import { PropertyService } from "@/domain/properties/service";
import { propertyCode, propertyHeadline } from "@/components/domain/properties/property-labels";
import type { Locale } from "@/i18n/config";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("properties") };
}

export default async function PropertiesPage() {
  const t = await getTranslations("PropertiesPage");
  const enums = await getTranslations("Enums");
  const format = await getFormatter();
  const membership = await getCurrentMembership();
  if (!membership) {
    const tErrors = await getTranslations("errors");
    return <p className="text-sm text-muted-foreground">{tErrors("noMembership")}</p>;
  }
  const supabase = await createSupabaseServer();
  const locale = (await getLocale()) as Locale;
  const properties = await new PropertyService(supabase).listRecent(membership.agencyId, locale);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Link href="/properties/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newProperty")}
        </Link>
      </div>

      {properties.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/properties/${property.id}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-accent"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{propertyCode(property)}</span>
                  <span className="font-medium">{propertyHeadline(enums, property)}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {[property.area_name, property.settlement_name].filter(Boolean).join(", ")}
                  {property.area_m2 &&
                    ` · ${t("squareMeters", { value: format.number(Number(property.area_m2), { maximumFractionDigits: 2 }) })}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
