import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ContactService } from "@/domain/contacts/service";
import { ContactMethodList } from "@/components/domain/contacts/contact-method-list";
import { ContactDetailClient } from "./contact-detail-client";
import {
  ChevronLeft,
  Building2,
  User,
  Archive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TimelineService } from "@/domain/timeline/service";
import { ContactActivity } from "./contact-activity";
import { OpportunityService } from "@/domain/opportunities/service";
import { StageRepository } from "@/domain/stages/repository";
import { LinkedOpportunities } from "@/components/domain/contacts/linked-opportunities";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single();

  const agencyId = membership?.agency_id ?? "";
  if (!agencyId) notFound();

  const service = new ContactService(supabase);
  const contact = await service.getById(id, agencyId);

  if (!contact) notFound();

  const timelineService = new TimelineService(supabase);
  
  const [timeline, opportunities, stages] = await Promise.all([
    timelineService.getContactTimeline(id, agencyId),
    new OpportunityService(supabase).getByContactId(id, agencyId),
    new StageRepository(supabase).findActive(agencyId)
  ]);

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

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/contacts"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Contacts
        </Link>
      </div>

      {/* Profile header */}
      <div className="mb-8 flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {contact.display_name}
            </h1>
            <Badge variant="secondary" className="gap-1">
              {isPerson ? (
                <User className="h-3 w-3" />
              ) : (
                <Building2 className="h-3 w-3" />
              )}
              {isPerson ? "Person" : "Organization"}
            </Badge>
            {contact.status === "archived" && (
              <Badge variant="secondary" className="gap-1 opacity-60">
                <Archive className="h-3 w-3" />
                Archived
              </Badge>
            )}
          </div>
          {contact.company_name && isPerson && (
            <p className="mt-1 text-sm text-muted-foreground">
              {contact.company_name}
            </p>
          )}
          {importedFileName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Imported from {importedFileName}
            </p>
          )}
        </div>

        {/* Actions: edit + archive */}
        <ContactDetailClient contact={contact} agencyId={agencyId} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact methods */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contact methods
          </h2>
          <div className="rounded-lg border bg-card p-4">
            <ContactMethodList
              contactId={contact.id}
              methods={contact.contact_methods}
            />
          </div>
        </section>

        {/* Linked opportunities */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Linked opportunities
            </h2>
            {opportunities.length > 0 && (
              <Badge variant="secondary">{opportunities.length}</Badge>
            )}
          </div>
          <LinkedOpportunities opportunities={opportunities} stages={stages} />
        </section>
      </div>

      {/* Notes */}
      {contact.notes && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h2>
          <div className="rounded-lg border bg-card p-4 whitespace-pre-wrap text-sm">
            {contact.notes}
          </div>
        </section>
      )}

      {/* Activity Timeline */}
      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Activity History
        </h2>
        <ContactActivity initialTimeline={timeline} contactId={id} currentUserId={user?.id} />
      </section>
    </div>
  );
}
