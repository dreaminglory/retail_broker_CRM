"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TaskCard } from "@/components/domain/tasks/task-card";
import { TaskCompleteDialog } from "@/components/domain/tasks/task-complete-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Clock,
  Inbox,
  ArrowRight,
  CheckCircle,
  Briefcase,
  Phone,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Task } from "@/domain/tasks/types";
import type { Inquiry } from "@/domain/inquiries/types";
import type { Stage } from "@/domain/stages/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { AtRiskOpportunity } from "@/domain/tasks/repository";
import type { CompleteTaskWithNextInput } from "@/domain/tasks/types";
import type { ActionResult } from "@/lib/actions";

interface TodayPageClientProps {
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

export function TodayPageClient({
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
  const [completingTask, setCompletingTask] = useState<Task | null>(null);

  const totalItems = overdue.length + dueToday.length + newInquiries.length;
  const hasWork = totalItems > 0 || atRisk.length > 0 || upcoming.length > 0;

  return (
    <>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasWork
              ? `You have ${totalItems} item${totalItems !== 1 ? "s" : ""} that need attention`
              : "All caught up — no pending work right now!"}
          </p>
        </div>

        {/* Summary badges */}
        {hasWork && (
          <div className="mb-6 flex flex-wrap gap-2">
            {overdue.length > 0 && (
              <Badge variant="destructive" className="gap-1.5 text-xs px-3 py-1">
                <AlertTriangle className="h-3 w-3" />
                {overdue.length} overdue
              </Badge>
            )}
            {newInquiries.length > 0 && (
              <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <Inbox className="h-3 w-3" />
                {newInquiries.length} new inquir{newInquiries.length !== 1 ? "ies" : "y"}
              </Badge>
            )}
            {dueToday.length > 0 && (
              <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <CalendarCheck className="h-3 w-3" />
                {dueToday.length} due today
              </Badge>
            )}
            {atRisk.length > 0 && (
              <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1 text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700">
                <Briefcase className="h-3 w-3" />
                {atRisk.length} at risk
              </Badge>
            )}
          </div>
        )}

        <div className="space-y-8">
          {/* ── Section 1: Overdue ─────────────────────────────────────── */}
          {overdue.length > 0 && (
            <Section
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              title="Overdue"
              count={overdue.length}
              variant="destructive"
            >
              <div className="space-y-2">
                {overdue.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={() => setCompletingTask(task)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* ── Section 2: New Inquiries ──────────────────────────────── */}
          {newInquiries.length > 0 && (
            <Section
              icon={<Inbox className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              title="New Inquiries"
              count={newInquiries.length}
              variant="info"
            >
              <div className="space-y-2">
                {newInquiries.map((inq) => (
                  <Link
                    key={inq.id}
                    href={`/inquiries?id=${inq.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3.5 transition-all hover:shadow-sm hover:border-blue-300/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {inq.caller_name || inq.caller_phone || inq.caller_email || "Unknown caller"}
                      </p>
                      {inq.subject && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {inq.subject}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(inq.received_at), { addSuffix: true })}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* ── Section 3: Due Today ──────────────────────────────────── */}
          {dueToday.length > 0 && (
            <Section
              icon={<CalendarCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              title="Due Today"
              count={dueToday.length}
              variant="warning"
            >
              <div className="space-y-2">
                {dueToday.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={() => setCompletingTask(task)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* ── Section 4: Coming Up ──────────────────────────────────── */}
          {upcoming.length > 0 && (
            <Section
              icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
              title="Coming Up"
              count={upcoming.length}
              variant="default"
            >
              <div className="space-y-2">
                {upcoming.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={() => setCompletingTask(task)}
                    showOpportunity
                  />
                ))}
              </div>
            </Section>
          )}

          {/* ── Section 5: At Risk ────────────────────────────────────── */}
          {atRisk.length > 0 && (
            <Section
              icon={<Briefcase className="h-4 w-4 text-orange-500" />}
              title="At Risk — No Next Action"
              count={atRisk.length}
              variant="warning"
            >
              <div className="space-y-2">
                {atRisk.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/opportunities/${opp.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3.5 transition-all hover:shadow-sm hover:border-orange-300/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{opp.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opp.stage_name} · {opp.type}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(new Date(opp.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* ── Empty state ───────────────────────────────────────────── */}
          {!hasWork && (
            <div className="rounded-lg border bg-card p-12 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 mb-4">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-lg mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                You have no overdue tasks, pending work, or at-risk opportunities. 
                Great job staying on top of things.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" onClick={() => router.push("/contacts")}>
                  View Contacts
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/opportunities")}>
                  View Opportunities
                </Button>
              </div>
            </div>
          )}
        </div>
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

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  count,
  variant,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  variant: "destructive" | "warning" | "info" | "default";
  children: React.ReactNode;
}) {
  const borderColor = {
    destructive: "border-l-destructive",
    warning: "border-l-amber-400 dark:border-l-amber-600",
    info: "border-l-blue-400 dark:border-l-blue-600",
    default: "border-l-muted-foreground/30",
  }[variant];

  return (
    <div className={cn("border-l-2 pl-4", borderColor)}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}
