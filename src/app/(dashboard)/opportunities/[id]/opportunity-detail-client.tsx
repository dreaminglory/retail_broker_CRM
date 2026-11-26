"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StageBadge } from "@/components/domain/opportunities/stage-badge";
import { StagePath } from "@/components/domain/opportunities/stage-path";
import { TabPanel, Tabs, useTabsId, type TabItem } from "@/components/ui/tabs";
import { useUrlParam } from "@/lib/use-url-param";
import type { DealTab } from "./deal-tabs";
import { OpportunityForm } from "@/components/domain/opportunities/opportunity-form";
import { ParticipantList } from "@/components/domain/opportunities/participant-list";
import { TaskList } from "@/components/domain/opportunities/task-list";
import { CloseOpportunityDialog } from "@/components/domain/opportunities/close-opportunity-dialog";
import { OpportunityActivity } from "./opportunity-activity";
import { PropertyLinks, SubjectProperty } from "@/components/domain/opportunities/property-links";
import type { OpportunityPropertyWithProperty } from "@/domain/opportunity-properties/types";
import { RequirementSection } from "@/components/domain/requirements/requirement-section";
import type { Requirement } from "@/domain/requirements/types";
import { requirementEditable } from "@/domain/requirements/validation";
import {
  updateOpportunityAction,
  changeOpportunityStageAction,
  closeOpportunityAction,
  reactivateOpportunityAction,
  addParticipantAction,
  removeParticipantAction,
} from "../actions";
import { createTaskAction, completeTaskAction } from "./tasks/actions";
import type { OpportunityWithDetails } from "@/domain/opportunities/types";
import type { Stage } from "@/domain/stages/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { ContactWithMethods } from "@/domain/contacts/types";
import { LogCallButton } from "@/components/domain/calls/log-call-button";
import { ContactQuickLinks } from "@/components/domain/calls/contact-quick-links";
import { opportunityCallTarget } from "@/components/domain/calls/call-targets";
import type { Task } from "@/domain/tasks/types";
import type { TimelineEntry } from "@/domain/timeline/types";
import type { ActiveBroker } from "@/domain/members/types";
import { ArrowLeft, Pencil, Link as LinkIcon, FileText, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContactLinks } from "@/components/domain/calls/contact-links";
import { contactEmail, contactPhone } from "@/domain/tasks/call-phone";
import { propertyCode, propertyHeadline } from "@/components/domain/properties/property-labels";
import { useTranslations, useFormatter } from "next-intl";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";

interface OpportunityDetailClientProps {
  opportunity: OpportunityWithDetails;
  stages: Stage[];
  leadSources: LeadSource[];
  /** The deal's primary contact and participants, with their methods for the call links. */
  contacts: ContactWithMethods[];
  brokers: ActiveBroker[];
  tasks: Task[];
  timeline: TimelineEntry[];
  currentUserId?: string;
  /** The agency's timezone, for task due times. */
  timeZone: string;
  /** Linked properties (candidates on buyer and tenant deals). */
  propertyLinks: OpportunityPropertyWithProperty[];
  /** The client's search; null on a buyer or tenant deal without one, and on seller or landlord deals. */
  requirement: Requirement | null;
  /** The server-rendered matches section (spec: matching); null on a closed or non-buyer/tenant deal. */
  matchesSection?: ReactNode;
  /** The open tab, from `?tab=` (spec ui-bright: Път is the default). */
  initialTab: DealTab;
}

export function OpportunityDetailClient({
  opportunity,
  stages,
  leadSources,
  contacts,
  brokers,
  tasks,
  timeline,
  currentUserId,
  timeZone,
  propertyLinks,
  matchesSection,
  requirement,
  initialTab,
}: OpportunityDetailClientProps) {
  const t = useTranslations("OpportunityDetail");
  const getStageName = useStageTranslation();
  const enums = useTranslations("Enums");
  const format = useFormatter();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const tProperties = useTranslations("PropertyLinks");
  const tForm = useTranslations("OpportunityForm");
  const tRequirement = useTranslations("RequirementSection");

  // Tabs Път / Имоти / Изисквания / История (deal.png). Seller and landlord deals have no
  // requirement, so no Изисквания tab; `?tab=requirements` on one falls back to Път.
  const hasRequirementTab = opportunity.type === "buyer" || opportunity.type === "tenant";
  const tabItems: TabItem<DealTab>[] = [
    { value: "path", label: t("tabs.path") },
    { value: "properties", label: tProperties("title"), count: propertyLinks.length },
    ...(hasRequirementTab ? [{ value: "requirements" as const, label: tRequirement("title") }] : []),
    { value: "history", label: t("activityHistoryTitle") },
  ];
  const [tab, setTabState] = useState<DealTab>(
    tabItems.some((item) => item.value === initialTab) ? initialTab : "path"
  );
  const [, setTabParam] = useUrlParam("tab");
  const setTab = (next: DealTab) => {
    setTabState(next);
    setTabParam(next === "path" ? null : next);
  };
  const tabsId = useTabsId();

  async function handleStageChange(stageId: string) {
    if (stageId === opportunity.stage_id) return;
    await changeOpportunityStageAction(opportunity.id, stageId);
    router.refresh();
  }

  const currentStage = stages.find((s) => s.id === opportunity.stage_id);
  const primaryContact = contacts.find((c) => c.id === opportunity.primary_contact_id) ?? null;

  // What a call from this page logs against (spec phone-loop rule 2): this deal and the contact.
  const pendingTaskCount = tasks.filter((task) => task.status === "pending").length;
  const stageOptions = stages.map((s) => ({ id: s.id, name: s.name }));
  const callTargetFor = (contact: ContactWithMethods | null) =>
    opportunityCallTarget(opportunity, contact, pendingTaskCount, stageOptions);
  const source = leadSources.find((s) => s.id === opportunity.source_id);
  const ownerName = brokers.find((b) => b.id === opportunity.assigned_to)?.display_name;
  const phone = primaryContact ? contactPhone(primaryContact) : null;
  const email = primaryContact ? contactEmail(primaryContact) : null;
  // Viewed properties (deal.png's right column): the linked ones, offered or seen.
  const viewed = propertyLinks.filter((link) => link.status !== "rejected");
  
  const formatter = new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: opportunity.currency || "EUR",
    maximumFractionDigits: 0,
  });

  return (
    <>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2"
          onClick={() => router.push("/opportunities")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t("backBtn")}
        </Button>
      </div>

      {/* Phone: header, contact, tabs, then the rest of the right column (spec ui-bright plan). */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <header className="min-w-0 rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge>{enums(`opportunityType.${opportunity.type}`)}</Badge>
                {currentStage && <StageBadge stage={currentStage} />}
                {opportunity.status === "active" && (
                  <Badge variant="secondary">{enums("opportunityStatus.active")}</Badge>
                )}
                {opportunity.temperature && (
                  <Badge variant="outline">{enums(`opportunityTemperature.${opportunity.temperature}`)}</Badge>
                )}
                {opportunity.status !== "active" && opportunity.closed_at && (
                  <span className="text-small font-semibold text-ink">
                    {t("closedLabel", { date: format.dateTime(new Date(opportunity.closed_at), { month: "short", day: "numeric", year: "numeric" }) })}
                  </span>
                )}
              </div>
              <h1 className="text-title text-ink [overflow-wrap:anywhere]">{opportunity.title}</h1>
              <p className="mt-1 text-body text-muted-foreground">
                {t("expectedValue")}:{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {opportunity.expected_value ? formatter.format(opportunity.expected_value) : t("none")}
                </span>
                {ownerName && (
                  <>
                    {" · "}
                    {tForm("assignedToLabel")}: <span className="text-ink">{ownerName}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LogCallButton target={callTargetFor(primaryContact)} />

              {opportunity.status === "active" && (
                <div className="flex items-center gap-2">
                  <span className="text-small text-muted-foreground">{t("stageLabel")}</span>
                  <Select value={opportunity.stage_id} onValueChange={(v) => { if (v) handleStageChange(v as string); }}>
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue>
                        {(val) => getStageName(stages.find((s) => s.id === val)?.name ?? "") || t("stagePlaceholder")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {getStageName(s.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {opportunity.status === "active" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCloseOpen(true)}
                >
                  {t("closeBtn")}
                </Button>
              )}

              {opportunity.status !== "active" && (
                <form action={async () => { await reactivateOpportunityAction(opportunity.id); }}>
                  <Button type="submit" variant="outline" size="sm">
                    {t("reactivateBtn")}
                  </Button>
                </form>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                {t("editBtn")}
              </Button>
            </div>
          </div>
          <div className="border-t border-border px-5 pt-3">
            <Tabs label={t("tabs.label")} items={tabItems} value={tab} onChange={setTab} idBase={tabsId} />
          </div>
        </header>

        <aside className="lg:col-start-2 lg:row-start-1">
          <div className="space-y-6">
            <section aria-label={t("primaryContact")} className="rounded-lg border border-border bg-surface p-5">
              {primaryContact ? (
                <>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sea-light text-body-strong text-primary">
                      {initials(primaryContact.display_name)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/contacts/${primaryContact.id}`}
                        className="block truncate text-body-strong text-ink hover:text-primary hover:underline"
                      >
                        {primaryContact.display_name}
                      </Link>
                      <p className="text-small text-muted-foreground">{t("primaryContact")}</p>
                    </div>
                  </div>
                  {(phone || email) && (
                    <dl className="mt-4 space-y-2 text-body">
                      {phone && (
                        <div className="flex items-center gap-2">
                          <dt><Phone className="size-4 text-muted-foreground" aria-hidden /></dt>
                          <dd className="min-w-0 truncate tabular-nums">{phone.value}</dd>
                        </div>
                      )}
                      {email && (
                        <div className="flex items-center gap-2">
                          <dt><Mail className="size-4 text-muted-foreground" aria-hidden /></dt>
                          <dd className="min-w-0 truncate">{email}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {(phone || email) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {phone && (
                        <ContactLinks
                          value={phone.value}
                          type={phone.type}
                          name={primaryContact.display_name}
                          callTarget={callTargetFor(primaryContact)}
                          showLabels
                        />
                      )}
                      {email && <ContactLinks value={email} type="email" name={primaryContact.display_name} showLabels />}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-small text-muted-foreground">{t("primaryContact")}</h2>
                  <p className="mt-1 text-body text-muted-foreground">{t("none")}</p>
                </>
              )}
            </section>
          </div>
        </aside>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-2">

          {tab === "path" && (
            <TabPanel idBase={tabsId} value="path" className="space-y-6">
              <section aria-labelledby={`${tabsId}-path-title`} className="rounded-lg border border-border bg-surface p-5">
                <h2 id={`${tabsId}-path-title`} className="mb-5 text-label uppercase text-muted-foreground">
                  {t("tabs.path")}
                </h2>
                <StagePath stages={stages} currentStageId={opportunity.stage_id} label={t("tabs.path")} />
              </section>

              <TaskList
                opportunityId={opportunity.id}
                tasks={tasks}
                brokers={brokers}
                stages={stages}
                timeZone={timeZone}
                linkedProperties={propertyLinks.map((link) => link.property).filter((property) => property.status === "active")}
                createAction={createTaskAction}
                completeAction={completeTaskAction}
              />

              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="mb-4 flex items-center gap-2 text-section text-ink">
                  <FileText className="size-4 text-muted-foreground" />
                  {t("detailsTitle")}
                </h3>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-body sm:grid-cols-2">
                  <div>
                    <dt className="mb-1 text-muted-foreground">{t("expectedValue")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {opportunity.expected_value ? formatter.format(opportunity.expected_value) : t("none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-muted-foreground">{t("leadSource")}</dt>
                    <dd className="font-semibold">{source?.name || t("none")}</dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-muted-foreground">{t("created")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {format.dateTime(new Date(opportunity.created_at), { month: "short", day: "numeric", year: "numeric" })}
                    </dd>
                  </div>
                  {opportunity.inquiry_id && (
                    <div>
                      <dt className="mb-1 text-muted-foreground">{t("origin")}</dt>
                      <dd className="flex items-center gap-1.5 font-semibold">
                        <LinkIcon className="size-3.5 text-muted-foreground" />
                        <Link href={`/inquiries?id=${opportunity.inquiry_id}`} className="text-primary hover:underline">
                          {t("viewInquiry")}
                        </Link>
                      </dd>
                    </div>
                  )}
                  {opportunity.notes && (
                    <div className="border-t border-border pt-4 sm:col-span-2">
                      <dt className="mb-2 text-muted-foreground">{t("notesTitle")}</dt>
                      <dd className="whitespace-pre-wrap">{opportunity.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </TabPanel>
          )}

          {tab === "properties" && (
            <TabPanel idBase={tabsId} value="properties" className="space-y-6">
              {hasRequirementTab ? (
                <>
                  {matchesSection}
                  <PropertyLinks opportunityId={opportunity.id} links={propertyLinks} />
                </>
              ) : (
                <SubjectProperty opportunityId={opportunity.id} links={propertyLinks} />
              )}
            </TabPanel>
          )}

          {tab === "requirements" && hasRequirementTab && (
            <TabPanel idBase={tabsId} value="requirements">
              <RequirementSection
                opportunityId={opportunity.id}
                requirement={requirement}
                opportunityType={opportunity.type}
                editable={requirementEditable(opportunity.status)}
              />
            </TabPanel>
          )}

          {tab === "history" && (
            <TabPanel idBase={tabsId} value="history">
              <section aria-labelledby={`${tabsId}-history-title`} className="rounded-lg border border-border bg-surface p-5">
                <h2 id={`${tabsId}-history-title`} className="mb-4 text-section text-ink">
                  {t("activityHistoryTitle")}
                </h2>
                <OpportunityActivity initialTimeline={timeline} opportunityId={opportunity.id} currentUserId={currentUserId} />
              </section>
            </TabPanel>
          )}
        </div>

        {/* Right column, below the contact card: viewed properties and the other people. */}
        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-2">
          {viewed.length > 0 && (
            <section aria-labelledby={`${tabsId}-viewed`} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 id={`${tabsId}-viewed`} className="text-section text-ink">{tProperties("title")}</h2>
                <span className="text-small tabular-nums text-muted-foreground">{viewed.length}</span>
              </div>
              <ul className="divide-y divide-border">
                {viewed.map((link) => (
                  <li key={link.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/properties/${link.property.id}`} className="block truncate text-body-strong text-ink hover:text-primary hover:underline">
                        {propertyCode(link.property)} · {propertyHeadline(enums, link.property)}
                      </Link>
                    </div>
                    <Badge variant="secondary">{enums(`propertyLinkStatus.${link.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ParticipantList
            opportunityId={opportunity.id}
            participants={opportunity.participants}
            contacts={contacts}
            addAction={addParticipantAction}
            removeAction={removeParticipantAction}
            contactLinks={(contact) => <ContactQuickLinks contact={contact} callTarget={callTargetFor(contact)} />}
          />
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            opportunity={opportunity}
            stages={stages}
            leadSources={leadSources}
            primaryContact={primaryContact}
            brokers={brokers}
            createAction={async () => ({ success: false, error: "Not used" })}
            updateAction={updateOpportunityAction.bind(null, opportunity.id)}
            hasRequirement={!!requirement}
            onSuccess={() => {
              setEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <CloseOpportunityDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        closeAction={closeOpportunityAction.bind(null, opportunity.id)}
        onSuccess={() => {
          setCloseOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

/** Two letters for the avatar (deal.png): first and last word. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}
