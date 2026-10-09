"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { 
  AlertCircle, 
  Clock, 
  AlertTriangle, 
  Timer, 
  BarChart, 
  UserPlus
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ExceptionData } from "@/domain/exceptions/repository";

interface ExceptionsPageClientProps {
  data: ExceptionData;
}

export function ExceptionsPageClient({ data }: ExceptionsPageClientProps) {
  const t = useTranslations("ExceptionsPage");
  const formatLoc = useFormatter();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 1. Unassigned Inquiries */}
        <Card className="col-span-2 md:col-span-1 border-destructive/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-destructive" /> {t('unassigned.title')} </CardTitle>
              <CardDescription>{t('unassigned.description')}</CardDescription>
            </div>
            <Badge variant="destructive" className="text-sm rounded-full w-8 h-8 flex items-center justify-center p-0">
              {data.unassignedInquiries.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {data.unassignedInquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('unassigned.empty')}</p>
            ) : (
              <div className="space-y-3">
                {data.unassignedInquiries.map((inq) => (
                  <div key={inq.id} className="flex flex-col gap-1 text-sm border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <Link href={`/inquiries`} className="font-medium hover:underline">
                        {inq.caller_name || t('unassigned.unknownCaller')}
                      </Link>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(inq.received_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">{inq.subject || inq.source_description || t('unassigned.noSubject')}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Overdue Tasks */}
        <Card className="col-span-2 md:col-span-1 border-orange-500/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" /> {t('overdue.title')} </CardTitle>
              <CardDescription>{t('overdue.description')}</CardDescription>
            </div>
            <Badge className="bg-orange-500 hover:bg-orange-600 text-sm rounded-full w-8 h-8 flex items-center justify-center p-0">
              {data.overdueTasksByBroker.reduce((acc, b) => acc + b.overdue_count, 0)}
            </Badge>
          </CardHeader>
          <CardContent>
            {data.overdueTasksByBroker.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('overdue.empty')}</p>
            ) : (
              <div className="space-y-3">
                {data.overdueTasksByBroker.map((broker) => (
                  <div key={broker.broker_id} className="flex justify-between items-center text-sm border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">{broker.broker_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('overdue.mostOverdue', { title: broker.most_overdue_task?.title ?? '', time: formatDistanceToNow(new Date(broker.most_overdue_task!.due_at as string), { addSuffix: true }) })}
                      </p>
                    </div>
                    <Badge variant="outline">{t('overdue.overdueBadge', { count: broker.overdue_count })}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. At Risk Opportunities (No Next Action) */}
        <Card className="col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" /> {t('atRisk.title')} </CardTitle>
              <CardDescription>{t('atRisk.description')}</CardDescription>
            </div>
            <Badge className="bg-amber-500 hover:bg-amber-600 text-sm rounded-full w-8 h-8 flex items-center justify-center p-0">
              {data.atRiskOpportunities.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {data.atRiskOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('atRisk.empty')}</p>
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
          </CardContent>
        </Card>

        {/* 4. Stale Opportunities */}
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Timer className="h-5 w-5 text-slate-500" /> {t('stale.title')} </CardTitle>
              <CardDescription>{t('stale.description')}</CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm rounded-full w-8 h-8 flex items-center justify-center p-0">
              {data.staleOpportunities.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {data.staleOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('stale.empty')}</p>
            ) : (
              <div className="space-y-3">
                {data.staleOpportunities.map((opp) => (
                  <div key={opp.id} className="flex flex-col gap-1 text-sm border-b pb-3 last:border-0 last:pb-0">
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
          </CardContent>
        </Card>

        {/* 5. Workload Distribution */}
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart className="h-5 w-5 text-indigo-500" /> {t('workload.title')} </CardTitle>
            <CardDescription>{t('workload.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.workloadDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('workload.empty')}</p>
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
                        <TableCell className="text-center">{broker.active_opportunities}</TableCell>
                        <TableCell className="text-center">{broker.pending_tasks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
