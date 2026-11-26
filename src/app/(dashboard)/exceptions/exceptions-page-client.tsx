"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { useRelativeTime } from "@/lib/i18n/use-relative-time";
import { 
  AlertCircle, 
  Clock, 
  Timer, 
  BarChart, 
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import type { ExceptionData } from "@/domain/exceptions/repository";
import type { ActiveBroker } from "@/domain/members/types";
import { reassignInquiryAction } from "../inquiries/actions";

interface ExceptionsPageClientProps {
  data: ExceptionData;
  brokers: ActiveBroker[];
}

function AssignInquirySelect({ inquiryId, brokers }: { inquiryId: string; brokers: ActiveBroker[] }) {
  const t = useTranslations("ExceptionsPage");
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState("");

  function handleAssign(brokerId: string) {
    setSelectedId(brokerId);
    startTransition(async () => {
      const result = await reassignInquiryAction(inquiryId, brokerId);
      if (!result.success) {
        toast.error(result.error);
        setSelectedId("");
      }
    });
  }

  return (
    <BrokerSelect
      brokers={brokers}
      value={selectedId}
      allowUnassigned={false}
      placeholder={t('unassigned.assignPlaceholder')}
      ariaLabel={t('unassigned.assignPlaceholder')}
      onValueChange={handleAssign}
      disabled={isPending}
    />
  );
}

export function ExceptionsPageClient({ data, brokers }: ExceptionsPageClientProps) {
  const t = useTranslations("ExceptionsPage");
  const formatLoc = useFormatter();
  const ago = useRelativeTime();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-title text-ink">{t('title')}</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* exceptions.png: each rule a collapsible card, severity by colour, one column. */}
      <div className="space-y-4">
        {/* 1. Unassigned Inquiries */}
        <ExceptionSection
          icon={<UserPlus className="size-5" />}
          title={t('unassigned.title')}
          description={t('unassigned.description')}
          severity="critical"
          count={data.unassignedInquiries.length}
        >
            {data.unassignedInquiries.length === 0 ? (
              <p className="py-4 text-center text-body text-muted-foreground">{t('unassigned.empty')}</p>
            ) : (
              <div className="space-y-3">
                {data.unassignedInquiries.map((inq) => (
                  <div key={inq.id} className="flex flex-col gap-1 border-b border-border pb-3 text-body last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <Link href={`/inquiries?id=${inq.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                        {inq.caller_name || t('unassigned.unknownCaller')}
                      </Link>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {ago(inq.received_at)}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">{inq.subject || inq.source_description || t('unassigned.noSubject')}</p>
                    <AssignInquirySelect inquiryId={inq.id} brokers={brokers} />
                  </div>
                ))}
              </div>
            )}
          </ExceptionSection>

        {/* 2. Overdue Tasks */}
        <ExceptionSection
          icon={<Clock className="size-5" />}
          title={t('overdue.title')}
          description={t('overdue.description')}
          severity="critical"
          count={data.overdueTasksByBroker.reduce((acc, b) => acc + b.overdue_count, 0)}
        >
            {data.overdueTasksByBroker.length === 0 ? (
              <p className="py-4 text-center text-body text-muted-foreground">{t('overdue.empty')}</p>
            ) : (
              <div className="space-y-3">
                {data.overdueTasksByBroker.map((broker) => (
                  <div key={broker.broker_id} className="flex items-center justify-between gap-3 border-b border-border pb-3 text-body last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">{broker.broker_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('overdue.mostOverdue', { title: broker.most_overdue_task?.title ?? '', time: ago(broker.most_overdue_task!.due_at as string) })}
                      </p>
                    </div>
                    <Badge variant="overdue">{t('overdue.overdueBadge', { count: broker.overdue_count })}</Badge>
                  </div>
                ))}
              </div>
            )}
          </ExceptionSection>

        {/* 3. At Risk Opportunities (No Next Action) */}
        <ExceptionSection
          icon={<AlertCircle className="size-5" />}
          title={t('atRisk.title')}
          description={t('atRisk.description')}
          severity="warning"
          count={data.atRiskOpportunities.length}
        >
            {data.atRiskOpportunities.length === 0 ? (
              <p className="py-4 text-center text-body text-muted-foreground">{t('atRisk.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('atRisk.columns.opportunity')}</TableHead>
                      <TableHead>{t('atRisk.columns.stage')}</TableHead>
                      <TableHead>{t('atRisk.columns.broker')}</TableHead>
                      <TableHead className="text-right">{t('atRisk.columns.created')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.atRiskOpportunities.map((opp) => (
                      <TableRow key={opp.id}>
                        <TableCell className="font-medium">
                          <Link href={`/opportunities/${opp.id}`} className="hover:underline">
                            {opp.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">{opp.stage_name}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{opp.assigned_to_name || t('atRisk.unassigned')}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatLoc.dateTime(new Date(opp.created_at), { month: "short", day: "numeric" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ExceptionSection>

        {/* 4. Stale Opportunities */}
        <ExceptionSection
          icon={<Timer className="size-5" />}
          title={t('stale.title')}
          description={t('stale.description')}
          severity="warning"
          count={data.staleOpportunities.length}
        >
            {data.staleOpportunities.length === 0 ? (
              <p className="py-4 text-center text-body text-muted-foreground">{t('stale.empty')}</p>
            ) : (
              <div className="space-y-3">
                {data.staleOpportunities.map((opp) => (
                  <div key={opp.id} className="flex flex-col gap-1 border-b border-border pb-3 text-body last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <Link href={`/opportunities/${opp.id}`} className="font-medium hover:underline truncate mr-2">
                        {opp.title}
                      </Link>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {t('stale.updated', { date: formatLoc.dateTime(new Date(opp.updated_at), { month: "short", day: "numeric" }) })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal text-[10px]">{opp.stage_name}</Badge>
                      <span className="text-xs text-muted-foreground">{t('stale.broker', { name: opp.assigned_to_name || t('stale.none') })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ExceptionSection>

        {/* 5. Workload Distribution */}
        <ExceptionSection
          icon={<BarChart className="size-5" />}
          title={t('workload.title')}
          description={t('workload.description')}
          severity="info"
        >
            {data.workloadDistribution.length === 0 ? (
              <p className="py-4 text-center text-body text-muted-foreground">{t('workload.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('workload.columns.broker')}</TableHead>
                      <TableHead className="text-center">{t('workload.columns.activeOpps')}</TableHead>
                      <TableHead className="text-center">{t('workload.columns.pendingTasks')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.workloadDistribution.map((broker) => (
                      <TableRow key={broker.broker_id}>
                        <TableCell className="text-xs font-medium">{broker.broker_name}</TableCell>
                        <TableCell className="text-center tabular-nums">{broker.active_opportunities}</TableCell>
                        <TableCell className="text-center tabular-nums">{broker.pending_tasks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ExceptionSection>
      </div>
    </div>
  );
}

const SEVERITY = {
  critical: { edge: "border-overdue/40", icon: "text-overdue", count: "bg-overdue-soft text-overdue" },
  warning: { edge: "border-at-risk/50", icon: "text-at-risk", count: "bg-at-risk-soft text-at-risk-ink" },
  info: { edge: "border-border", icon: "text-primary", count: "bg-accent text-primary" },
} as const;

/** One exception rule as a card (exceptions.png): icon, title, rule line, count; the rows fold away. */
function ExceptionSection({
  icon,
  title,
  description,
  severity,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  severity: keyof typeof SEVERITY;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const tone = SEVERITY[severity];
  // A rule with nothing to show is not a problem: neutral, whatever its severity.
  const quiet = count === 0;

  return (
    <section aria-labelledby={`${id}-title`} className={cn("rounded-lg border bg-surface", quiet ? "border-border" : tone.edge)}>
      <h2 id={`${id}-title`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start gap-3 rounded-lg px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className={cn("mt-0.5 shrink-0", quiet ? "text-muted-foreground" : tone.icon)}>{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-section text-ink">{title}</span>
            <span className="block text-small text-muted-foreground">{description}</span>
          </span>
          {count !== undefined && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-small font-semibold tabular-nums", quiet ? "bg-muted text-muted-foreground" : tone.count)}>
              {count}
            </span>
          )}
          <ChevronDown className={cn("mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      <div id={`${id}-body`} hidden={!open} className="border-t border-border px-5 py-4">
        {children}
      </div>
    </section>
  );
}
