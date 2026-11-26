"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TaskCard } from "@/components/domain/tasks/task-card";
import { TaskCompleteDialog } from "@/components/domain/tasks/task-complete-dialog";
import { TaskActionsMenu } from "@/components/domain/tasks/task-actions-menu";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Inbox,
  ChevronRight,
  CheckCircle,
  Briefcase,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";
import { relativeTimeBase } from "@/lib/time/relative-time";
import type { Task } from "@/domain/tasks/types";
import type { Inquiry } from "@/domain/inquiries/types";
import type { Stage } from "@/domain/stages/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { AtRiskOpportunity } from "@/domain/tasks/repository";
import type { CompleteTaskWithNextInput } from "@/domain/tasks/types";
import type { ActionResult } from "@/lib/actions";
import type { TodayScope } from "./today-data";

interface TodayPageClientProps {
  scope: TodayScope;
  timeZone: string;
  /** Owners and managers can switch between their own work and the agency's (AD-044). */
  canSwitchScope: boolean;
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
  atRisk: AtRiskOpportunity[];
  newInquiries: Inquiry[];
  stages: Stage[];
  brokers: ActiveBroker[];
  completeAction: (
    taskId: string,
    input: CompleteTaskWithNextInput
  ) => Promise<ActionResult<unknown>>;
}

/**
 * Today as `today.png`: greeting and summary line, then the follow-up work as cards. Main column:
 * overdue (red tint), due today, no next step (amber). Side column: new inquiries, coming up.
 * On a phone the two columns stack in that same order.
 */
export function TodayPageClient({
  scope,
  timeZone,
  canSwitchScope,
  overdue,
  dueToday,
  upcoming,
  atRisk,
  newInquiries,
  stages,
  brokers,
  completeAction,
}: TodayPageClientProps) {
  const router = useRouter();
  const t = useTranslations('Today');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const since = (iso: string) => {
    const date = new Date(iso);
    return format.relativeTime(date, relativeTimeBase(date, now));
  };
  const enums = useTranslations("Enums");
  const getStageName = useStageTranslation();
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const brokerNames = new Map(brokers.map((b) => [b.id, b.display_name]));

  const renderTask = (task: Task) => (
    <li key={task.id}>
      <TaskCard
        task={task}
        timeZone={timeZone}
        assigneeName={scope === "agency" && task.assigned_to ? brokerNames.get(task.assigned_to) : undefined}
        onComplete={() => setCompletingTask(task)}
        menu={<TaskActionsMenu task={task} timeZone={timeZone} brokers={brokers} />}
      />
    </li>
  );

  const totalItems = overdue.length + dueToday.length + newInquiries.length;
  const hasWork = totalItems > 0 || atRisk.length > 0 || upcoming.length > 0;
  const hasSide = newInquiries.length > 0 || upcoming.length > 0;

  const summary = [
    overdue.length > 0 && { text: t("overdueCount", { count: overdue.length }), tone: "text-overdue font-semibold" },
    dueToday.length > 0 && { text: t("dueTodayCount", { count: dueToday.length }), tone: "text-ink" },
    newInquiries.length > 0 && { text: t("newInquiriesCount", { count: newInquiries.length }), tone: "text-primary" },
    atRisk.length > 0 && { text: t("atRiskCount", { count: atRisk.length }), tone: "text-at-risk-ink font-semibold" },
  ].filter((part): part is { text: string; tone: string } => !!part);

  return (
    <>
      <div className="mx-auto max-w-6xl">
        {/* Header: date, title, summary line; the scope switch on the right. */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-small text-muted-foreground first-letter:uppercase">
              {format.dateTime(now, { weekday: "long", day: "numeric", month: "long", timeZone })}
            </p>
            <h1 className="mt-1 text-display text-ink">{t("title")}</h1>
            <p className="mt-1 text-body text-muted-foreground">
              {hasWork ? (
                <>
                  <span className="sr-only">{t("hasWorkSubtitle", { count: totalItems })}</span>
                  <span aria-hidden className="flex flex-wrap gap-x-1.5">
                    {summary.map((part, i) => (
                      <span key={part.text} className={part.tone}>
                        {i > 0 && <span className="mr-1.5 font-normal text-muted-foreground">·</span>}
                        {part.text}
                      </span>
                    ))}
                  </span>
                </>
              ) : (
                t("allCaughtUpSubtitle")
              )}
            </p>
          </div>
          {canSwitchScope && (
            <div
              role="group"
              aria-label={t("scope.label")}
              className="inline-flex rounded-lg border border-border bg-surface p-1 text-body"
            >
              {(["mine", "agency"] as const).map((option) => (
                <Link
                  key={option}
                  href={option === "agency" ? "/today?scope=agency" : "/today"}
                  aria-current={scope === option ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    scope === option
                      ? "bg-accent font-semibold text-primary"
                      : "text-muted-foreground hover:text-ink"
                  )}
                >
                  {t(`scope.${option}`)}
                </Link>
              ))}
            </div>
          )}
        </div>

        {hasWork ? (
          <div className={cn("grid items-start gap-6", hasSide && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
            <div className="space-y-6">
              {overdue.length > 0 && (
                <Section
                  icon={<AlertTriangle className="size-4 text-overdue" />}
                  title={t("sections.overdue")}
                  count={overdue.length}
                  tone="overdue"
                >
                  <ul className="divide-y divide-overdue/15 bg-overdue-soft">{overdue.map(renderTask)}</ul>
                </Section>
              )}

              {dueToday.length > 0 && (
                <Section
                  icon={<CalendarCheck className="size-4 text-primary" />}
                  title={t("sections.dueToday")}
                  count={dueToday.length}
                >
                  <ul className="divide-y divide-border">{dueToday.map(renderTask)}</ul>
                </Section>
              )}

              {atRisk.length > 0 && (
                <Section
                  icon={<AlertTriangle className="size-4 text-at-risk" />}
                  title={t("sections.atRisk")}
                  count={atRisk.length}
                  tone="atRisk"
                >
                  <ul className="divide-y divide-border">
                    {atRisk.map((opp) => (
                      <li key={opp.id}>
                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="group/row flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-sea-light text-primary">
                            <Briefcase className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-strong text-ink">{opp.title}</span>
                            <span className="mt-0.5 block truncate text-small text-muted-foreground">
                              {getStageName(opp.stage_name)} · {enums(`opportunityType.${opp.type}` as never)}
                            </span>
                          </span>
                          <span className="shrink-0 text-small text-at-risk-ink tabular-nums">
                            {t("updated")} {since(opp.updated_at)}
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-primary" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            {hasSide && (
              <div className="space-y-6">
                {newInquiries.length > 0 && (
                  <Section
                    icon={<Inbox className="size-4 text-primary" />}
                    title={t("sections.newInquiries")}
                    count={newInquiries.length}
                  >
                    <ul className="divide-y divide-border">
                      {newInquiries.map((inq) => (
                        <li key={inq.id}>
                          <Link
                            href={`/inquiries?id=${inq.id}`}
                            className="group/row flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-sea-light text-primary">
                              <Phone className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body-strong text-ink">
                                {inq.caller_name || inq.caller_phone || inq.caller_email || t("unknownCaller")}
                              </span>
                              {inq.subject && (
                                <span className="mt-0.5 block truncate text-small text-muted-foreground">{inq.subject}</span>
                              )}
                              <span className="mt-0.5 block text-small text-muted-foreground tabular-nums">
                                {since(inq.received_at)}
                              </span>
                            </span>
                            <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-primary" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {upcoming.length > 0 && (
                  <Section
                    icon={<CalendarClock className="size-4 text-muted-foreground" />}
                    title={t("sections.comingUp")}
                    count={upcoming.length}
                  >
                    <ul className="divide-y divide-border">{upcoming.map(renderTask)}</ul>
                  </Section>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <div className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-done-soft text-done">
              <CheckCircle className="size-7" />
            </div>
            <h2 className="mb-1 text-section text-ink">{t("emptyState.title")}</h2>
            <p className="mx-auto max-w-sm text-body text-muted-foreground">{t("emptyState.description")}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push("/contacts")}>{t("emptyState.viewContacts")}</Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/opportunities")}>{t("emptyState.viewOpportunities")}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Task completion dialog */}
      {completingTask && (
        <TaskCompleteDialog
          task={completingTask}
          stages={stages}
          brokers={brokers}
          open={!!completingTask}
          onOpenChange={(open) => {
            if (!open) setCompletingTask(null);
          }}
          completeAction={completeAction}
        />
      )}
    </>
  );
}

// ── Section card ────────────────────────────────────────────────────────────

/**
 * A Today section as a flat card. `overdue` tints the rows red (the card's list does that);
 * `atRisk` gives the card an amber edge and header, as the PNG's "Без следваща стъпка".
 */
function Section({
  icon,
  title,
  count,
  tone = "default",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  tone?: "default" | "overdue" | "atRisk";
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "@container overflow-hidden rounded-lg border bg-surface",
        tone === "atRisk" ? "border-at-risk/50" : "border-border"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-3 sm:px-5",
          tone === "atRisk" ? "border-at-risk/30 bg-at-risk-soft" : "border-border"
        )}
      >
        {icon}
        <h2 className="text-section text-ink">{title}</h2>
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-small font-semibold tabular-nums",
            tone === "overdue" ? "bg-overdue-soft text-overdue" : tone === "atRisk" ? "bg-surface text-at-risk-ink" : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}
