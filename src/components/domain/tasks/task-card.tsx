"use client";
import { useFormatter, useNow, useTranslations } from "next-intl";

import Link from "next/link";
import {
  Phone,
  Mail,
  Eye,
  Users,
  CalendarCheck,
  MoreHorizontal,
  Check,
  Briefcase,
} from "lucide-react";
import type { Task, TaskType } from "@/domain/tasks/types";
import { todayBucket } from "@/lib/time/agency-day";
import { cn } from "@/lib/utils";
import { TaskPropertyLine } from "./task-property-line";
import { ContactLinks } from "@/components/domain/calls/contact-links";
import type { PostCallTarget } from "@/components/domain/calls/post-call-sheet";

/**
 * What a tap on a Today call task logs against (spec phone-loop rule 2): that task, so the
 * prompt completes it, and its deal, contact and inquiry. A display name, never the number.
 */
export function taskCallTarget(task: Task, unknownName: string): Omit<PostCallTarget, "channel"> {
  return {
    context: {
      opportunity_id: task.opportunity_id,
      contact_id: task.contact_id,
      inquiry_id: task.inquiry_id ?? null,
      task_id: task.id,
    },
    name: task.call_phone?.name || unknownName,
    closed: !!task.opportunity_id && !!task.opportunity_status && task.opportunity_status !== "active",
  };
}

interface TaskCardProps {
  task: Task;
  /** The agency's timezone: "today" and the times shown are agency time. */
  timeZone: string;
  opportunityTitle?: string;
  /** Shown under the title, e.g. on Today's agency scope. */
  assigneeName?: string;
  onComplete: (taskId: string) => void;
  showOpportunity?: boolean;
  /** The task menu (edit, reschedule, cancel). */
  menu?: React.ReactNode;
}

const TASK_TYPE_CONFIG: Record<TaskType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  call: { icon: Phone, label: "Call", color: "bg-sea-light text-primary" },
  email: { icon: Mail, label: "Email", color: "bg-sea-light text-primary" },
  viewing: { icon: Eye, label: "Viewing", color: "bg-sea-light text-primary" },
  meeting: { icon: Users, label: "Meeting", color: "bg-sea-light text-primary" },
  follow_up: { icon: CalendarCheck, label: "Follow-up", color: "bg-sea-light text-primary" },
  other: { icon: MoreHorizontal, label: "Other", color: "bg-sea-light text-primary" },
};

/**
 * A task as a Today row (today.png): checkbox, type icon, title, context line, time and the row
 * action. The section card around it carries the overdue tint; the row only colours the time.
 */
export function TaskCard({
  task,
  timeZone,
  opportunityTitle,
  assigneeName,
  onComplete,
  showOpportunity = true,
  menu,
}: TaskCardProps) {
  const t = useTranslations("TaskCard");
  const tCall = useTranslations("phoneLoop");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const bucket = task.due_at ? todayBucket(task.due_at, timeZone, now) : null;
  const pending = task.status === "pending";
  const isOverdue = bucket === "overdue" && pending;
  const isDueToday = bucket === "dueToday";
  const typeConfig = task.task_type ? TASK_TYPE_CONFIG[task.task_type] : null;
  const TypeIcon = typeConfig?.icon ?? CalendarCheck;

  const resolvedOppTitle = opportunityTitle || ("opportunity_title" in task ? (task as unknown as Record<string, string>).opportunity_title : undefined);
  const resolvedAssignee =
    assigneeName ?? ("assignee_name" in task ? (task as unknown as Record<string, string>).assignee_name : undefined);
  const callPhone = task.task_type === "call" && pending ? task.call_phone : null;

  const due = task.due_at ? new Date(task.due_at) : null;
  const when = !due
    ? null
    : isOverdue
      ? format.dateTime(due, { weekday: "short", day: "numeric", month: "short", timeZone })
      : isDueToday
        ? format.dateTime(due, { hour: "2-digit", minute: "2-digit", timeZone })
        : format.dateTime(due, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
  const overdueLabel = due && isOverdue ? t("overdueSince", { relative: format.relativeTime(due, now) }) : undefined;

  // Lay out by the width of the card it sits in (an `@container`), not the viewport, so the same
  // row works in Today's main column, its side column and on a phone.
  return (
    <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-4 py-3 @md:grid-cols-[auto_auto_minmax(0,1fr)_auto] @md:items-center @md:px-5">
      {/* The checkbox opens completion (outcome + next step); it never completes silently. */}
      {pending ? (
        <button
          type="button"
          aria-label={t("complete")}
          title={t("complete")}
          data-slot="task-check"
          onClick={(e) => {
            e.stopPropagation();
            onComplete(task.id);
          }}
          className="group/check relative mt-2 flex after:absolute after:-inset-3 after:content-[''] size-5 shrink-0 items-center justify-center rounded-sm border-2 border-border-strong bg-surface text-primary transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 @md:mt-0"
        >
          <Check className="size-3.5 opacity-0 transition-opacity group-hover/check:opacity-100" aria-hidden />
        </button>
      ) : (
        <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary text-on-primary @md:mt-0" aria-hidden>
          <Check className="size-3.5" />
        </span>
      )}

      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border border-border",
          typeConfig?.color ?? "bg-muted text-muted-foreground",
        )}
        title={typeConfig ? t(`types.${task.task_type}`) : undefined}
      >
        <TypeIcon className="size-4" />
        {typeConfig && <span className="sr-only">{t(`types.${task.task_type}`)}</span>}
      </div>

      <div className="min-w-0">
        <p className={cn("truncate text-body-strong text-ink", !pending && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        {((showOpportunity && resolvedOppTitle) || resolvedAssignee) && (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 text-small text-muted-foreground">
            {showOpportunity && resolvedOppTitle && (
              task.opportunity_id ? (
                <Link
                  href={`/opportunities/${task.opportunity_id}`}
                  className="flex min-w-0 items-center gap-1 transition-colors hover:text-primary"
                >
                  <Briefcase className="size-3 shrink-0" />
                  <span className="truncate">{resolvedOppTitle}</span>
                </Link>
              ) : (
                <span className="flex min-w-0 items-center gap-1">
                  <Briefcase className="size-3 shrink-0" />
                  <span className="truncate">{resolvedOppTitle}</span>
                </span>
              )
            )}
            {resolvedAssignee && (
              <span className="flex min-w-0 items-center gap-1">
                <Users className="size-3 shrink-0" />
                <span className="truncate">{resolvedAssignee}</span>
              </span>
            )}
          </div>
        )}
        {task.property && <TaskPropertyLine property={task.property} />}
      </div>

      {/* Narrow card (phone, side column): under the text. Wide card: at the row's end. */}
      <div className="col-start-3 flex items-center justify-between gap-3 @md:col-start-4 @md:row-start-1 @md:justify-end">
        <DueTime when={when} overdue={isOverdue} overdueLabel={overdueLabel} empty={t("noDueDate")} />
        <RowActions callPhone={callPhone} task={task} unknownName={tCall("unknownName")} menu={pending ? menu : null} />
      </div>
    </div>
  );
}

function DueTime({
  when,
  overdue,
  overdueLabel,
  empty,
}: {
  when: string | null;
  overdue: boolean;
  overdueLabel?: string;
  empty: string;
}) {
  if (!when) return <span className="text-small italic text-muted-foreground">{empty}</span>;
  return (
    <span
      title={overdueLabel}
      className={cn("whitespace-nowrap text-small tabular-nums", overdue ? "font-semibold text-overdue" : "text-muted-foreground")}
    >
      {when}
      {overdueLabel && <span className="sr-only"> · {overdueLabel}</span>}
    </span>
  );
}

function RowActions({
  callPhone,
  task,
  unknownName,
  menu,
}: {
  callPhone: Task["call_phone"] | null;
  task: Task;
  unknownName: string;
  menu: React.ReactNode;
}) {
  if (!callPhone && !menu) return null;
  return (
    <div className="flex items-center gap-1">
      {callPhone && (
        <ContactLinks
          value={callPhone.value}
          type={callPhone.type}
          name={callPhone.name || unknownName}
          callTarget={taskCallTarget(task, unknownName)}
        />
      )}
      {menu}
    </div>
  );
}

export { TASK_TYPE_CONFIG };
