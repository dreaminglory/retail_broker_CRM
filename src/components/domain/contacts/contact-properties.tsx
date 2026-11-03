import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { propertyCode, propertyHeadline } from "@/components/domain/properties/property-labels";
import type { ContactPropertyParty } from "@/domain/property-parties/types";

/** The contact's properties with role; ended and archived ones are muted. */
export async function ContactProperties({ parties }: { parties: ContactPropertyParty[] }) {
  const t = await getTranslations("ContactProperties");
  const enums = await getTranslations("Enums");

  if (parties.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {parties.map((party) => {
        const inactive = party.ended_at !== null || party.property.status === "archived";
        return (
          <li key={party.id} className={inactive ? "opacity-60" : undefined}>
            <Link href={`/properties/${party.property.id}`} className="block space-y-1 px-4 py-3 hover:bg-accent">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{propertyCode(party.property)}</span>
                <span className="text-sm font-medium">{propertyHeadline(enums, party.property)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {[party.property.area_name, party.property.settlement_name].filter(Boolean).join(", ")}
                <Badge variant="secondary">{enums(`partyRole.${party.role}`)}</Badge>
                {party.ended_at !== null && <Badge variant="outline">{t("ended")}</Badge>}
                {party.property.status === "archived" && <Badge variant="outline">{t("archived")}</Badge>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
