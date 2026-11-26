import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { ContactProperties } from "@/components/domain/contacts/contact-properties";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ContactMethodList } from "@/components/domain/contacts/contact-method-list";
import { ContactDetailClient } from "./contact-detail-client";
import { loadContactDetail } from "../contact-data";
import { CONFIG_ROLES, hasRole } from "@/lib/roles";
import {
  ChevronLeft,
  Building2,
  User,
  Archive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContactActivity } from "./contact-activity";
import { LinkedOpportunities } from "@/components/domain/contacts/linked-opportunities";
import { FreshNowProvider } from "@/lib/i18n/fresh-now-provider";
import { DetailTabs } from "@/components/layout/detail-tabs";
import { parseChoice } from "@/lib/url-state";
import { LogCallButton } from "@/components/domain/calls/log-call-button";

const CONTACT_TABS = ["overview", "deals", "properties", "history"] as const;

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const t = await getTranslations("ContactDetailPage");
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single();

  const agencyId = membership?.agency_id ?? "";
  if (!agencyId) notFound();

  // The same loader as the contacts list's panel (spec ui-bright): one place for what a contact shows.
  const locale = (await getLocale()) as Locale;
  const detail = await loadContactDetail(supabase, agencyId, id, locale);
  if (!detail) notFound();
  const { contact, timeline, opportunities, requirementSummaries, stages, propertyParties, callTarget } = detail;

  const isPerson = contact.type === "person";
  const initials = contact.display_name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  let importedFileName = null;
  if (contact.import_job_id) {
    const { data: job } = await supabase
      .from("import_jobs")
      .select("file_name")
      .eq("id", contact.import_job_id)
      .single();
    if (job) importedFileName = job.file_name;
  }

  const header = (
    <div className="flex flex-wrap items-start gap-5 pb-1">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-section text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-title text-ink">{contact.display_name}</h1>
          <Badge variant="secondary" className="gap-1">
            {isPerson ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
            {isPerson ? t("typePerson") : t("typeOrganization")}
          </Badge>
          {contact.status === "archived" && (
            <Badge variant="secondary" className="gap-1 opacity-60">
              <Archive className="h-3 w-3" />
              {t("archived")}
            </Badge>
          )}
        </div>
        {contact.company_name && isPerson && (
          <p className="mt-1 text-body text-muted-foreground">{contact.company_name}</p>
        )}
        {importedFileName && (
          <p className="mt-1 text-small text-muted-foreground">{t("importedFrom", { fileName: importedFileName })}</p>
        )}
      </div>

      {/* Actions wrap under the name on a phone (spec phone-loop Screens). */}
      <div className="flex flex-wrap items-center gap-2">
        <LogCallButton target={callTarget} />
        <ContactDetailClient
          contact={contact}
          agencyId={agencyId}
          canMerge={hasRole(membership?.role, CONFIG_ROLES)}
        />
      </div>
    </div>
  );

  const heading = "text-label uppercase text-muted-foreground";
  const overview = (
    <>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className={heading}>{t("linkedOpportunities")}</h2>
          {opportunities.length > 0 && <Badge variant="secondary">{opportunities.length}</Badge>}
        </div>
        <LinkedOpportunities opportunities={opportunities} requirementSummaries={requirementSummaries} stages={stages} />
      </section>

      {/* Properties the contact is a party to */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className={heading}>{t("properties")}</h2>
          {propertyParties.length > 0 && <Badge variant="secondary">{propertyParties.length}</Badge>}
        </div>
        <ContactProperties parties={propertyParties} />
      </section>

      {contact.notes && (
        <section>
          <h2 className={`mb-3 ${heading}`}>{t("notes")}</h2>
          <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface p-4 text-sm">{contact.notes}</div>
        </section>
      )}
    </>
  );

  const dealsTab = (
    <section>
      <h2 className={`mb-3 ${heading}`}>{t("linkedOpportunities")}</h2>
      <LinkedOpportunities opportunities={opportunities} requirementSummaries={requirementSummaries} stages={stages} />
    </section>
  );

  const propertiesTab = (
    <section>
      <h2 className={`mb-3 ${heading}`}>{t("properties")}</h2>
      <ContactProperties parties={propertyParties} />
    </section>
  );

  const historyTab = (
    <section>
      <h2 className={`mb-4 ${heading}`}>{t("activityHistory")}</h2>
      <ContactActivity initialTimeline={timeline} contactId={id} currentUserId={user?.id} />
    </section>
  );

  // A fresh `now` per render: relative times match between the server and hydration.
  return (
    <FreshNowProvider now={new Date().toISOString()}>
      <div className="space-y-6">
        <Link
          href="/contacts"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("back")}
        </Link>

        <DetailTabs
          header={header}
          tabLabel={t("tabs.label")}
          items={[
            { value: "overview", label: t("tabs.overview") },
            { value: "deals", label: t("linkedOpportunities"), count: opportunities.length },
            { value: "properties", label: t("properties"), count: propertyParties.length },
            { value: "history", label: t("activityHistory"), count: timeline.length },
          ]}
          defaultTab="overview"
          initialTab={parseChoice(query.tab, CONTACT_TABS, "overview")}
          panels={{ overview, deals: dealsTab, properties: propertiesTab, history: historyTab }}
          aside={
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className={`mb-3 ${heading}`}>{t("contactMethods")}</h2>
              <ContactMethodList
                contactId={contact.id}
                contactName={contact.display_name}
                methods={contact.contact_methods}
                callTarget={callTarget}
              />
            </section>
          }
        />
      </div>
    </FreshNowProvider>
  );
}
