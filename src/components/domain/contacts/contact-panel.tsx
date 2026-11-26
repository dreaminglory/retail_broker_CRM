import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowUpRight, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContactMethodList } from "@/components/domain/contacts/contact-method-list";
import { LinkedOpportunities } from "@/components/domain/contacts/linked-opportunities";
import { ContactActivity } from "@/app/(dashboard)/contacts/[id]/contact-activity";
import type { ContactDetail } from "@/app/(dashboard)/contacts/contact-data";

/**
 * The selected contact beside the contacts list (contacts.png, ≥ 1024 px; below it the page
 * shows this alone): methods with their links, linked deals with their requirement lines, and
 * the timeline. The full contact page stays one click away. Loaded by `loadContactDetail`, the
 * same loader as the contact page, so no new query.
 */
export async function ContactPanel({
  detail,
  backHref,
  currentUserId,
}: {
  detail: ContactDetail;
  /** The list without `?id=`, for the phone's back link. */
  backHref: string;
  currentUserId?: string;
}) {
  const t = await getTranslations("ContactDetailPage");
  const { contact, opportunities, requirementSummaries, stages, timeline, callTarget } = detail;
  const isPerson = contact.type === "person";
  const initials = contact.display_name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <section aria-label={contact.display_name} data-testid="contact-panel" className="overflow-hidden rounded-lg border border-border bg-surface">
      <Link
        href={backHref}
        replace
        scroll={false}
        className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-small text-primary hover:underline lg:hidden"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("back")}
      </Link>

      <div className="flex items-start gap-3 p-5">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sea-light text-body-strong text-primary">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          {/* The name opens the full contact page. */}
          <h2 className="text-section [overflow-wrap:anywhere]">
            <Link href={`/contacts/${contact.id}`} className="inline-flex items-center gap-1 text-ink hover:text-primary hover:underline">
              {contact.display_name}
              <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden />
            </Link>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {isPerson ? <User aria-hidden /> : <Building2 aria-hidden />}
              {isPerson ? t("typePerson") : t("typeOrganization")}
            </Badge>
            {contact.status === "archived" && <Badge variant="outline">{t("archived")}</Badge>}
          </div>
        </div>
      </div>

      <div className="space-y-5 border-t border-border p-5">
        <div>
          <h3 className="mb-2 text-label uppercase text-muted-foreground">{t("contactMethods")}</h3>
          <ContactMethodList
            contactId={contact.id}
            contactName={contact.display_name}
            methods={contact.contact_methods}
            callTarget={callTarget}
          />
        </div>

        <div>
          <h3 className="mb-2 text-label uppercase text-muted-foreground">
            {t("linkedOpportunities")} <span className="tabular-nums">{opportunities.length}</span>
          </h3>
          <LinkedOpportunities opportunities={opportunities} requirementSummaries={requirementSummaries} stages={stages} />
        </div>
      </div>

      <div className="border-t border-border p-5">
        <h3 className="mb-3 text-label uppercase text-muted-foreground">{t("activityHistory")}</h3>
        <ContactActivity initialTimeline={timeline} contactId={contact.id} currentUserId={currentUserId} />
      </div>
    </section>
  );
}
