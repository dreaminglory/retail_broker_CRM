import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { PropertyOpportunityLink } from "@/domain/opportunity-properties/types";

/** The deals a property is linked to, with the link status; closed deals are muted. */
export async function PropertyOpportunities({
  links,
  action,
}: {
  links: PropertyOpportunityLink[];
  /** A header action, e.g. "Schedule viewing". */
  action?: React.ReactNode;
}) {
  const t = await getTranslations("PropertyOpportunities");
  const enums = await getTranslations("Enums");

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="property-opportunities">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="property-opportunities" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h2>
        {action}
      </div>
      {links.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y">
          {links.map((link) => {
            const closed = link.opportunity.status !== "active";
            return (
              <li key={link.id} className={closed ? "opacity-60" : undefined}>
                <Link
                  href={`/opportunities/${link.opportunity.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-accent"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{link.opportunity.title}</span>
                    <span className="text-xs text-muted-foreground">{enums(`opportunityType.${link.opportunity.type}`)}</span>
                    {closed && <Badge variant="outline">{t("closed")}</Badge>}
                  </span>
                  <Badge variant="secondary">
                    {link.status ? enums(`propertyLinkStatus.${link.status}`) : t("subject")}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
