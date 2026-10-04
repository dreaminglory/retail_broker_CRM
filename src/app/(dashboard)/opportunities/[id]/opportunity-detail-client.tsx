"use client";

import { useState } from "react";
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
import { OpportunityForm } from "@/components/domain/opportunities/opportunity-form";
import { ParticipantList } from "@/components/domain/opportunities/participant-list";
import { TaskList } from "@/components/domain/opportunities/task-list";
import { CloseOpportunityDialog } from "@/components/domain/opportunities/close-opportunity-dialog";
import { OpportunityActivity } from "./opportunity-activity";
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
import type { Contact } from "@/domain/contacts/types";
import type { Task } from "@/domain/tasks/types";
import type { TimelineEntry } from "@/domain/timeline/types";
import type { ActiveBroker } from "@/domain/members/types";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Link as LinkIcon, Building2, Calendar, FileText, Users } from "lucide-react";

interface OpportunityDetailClientProps {
  opportunity: OpportunityWithDetails;
  stages: Stage[];
  leadSources: LeadSource[];
  contacts: Contact[];
  brokers: ActiveBroker[];
  tasks: Task[];
  timeline: TimelineEntry[];
  currentUserId?: string;
  // inquiry?: Inquiry; // Optionally show inquiry details
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
}: OpportunityDetailClientProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  async function handleStageChange(stageId: string) {
    if (stageId === opportunity.stage_id) return;
    await changeOpportunityStageAction(opportunity.id, stageId);
    router.refresh();
  }

  const currentStage = stages.find((s) => s.id === opportunity.stage_id);
  const source = leadSources.find((s) => s.id === opportunity.source_id);
  
  const formatter = new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: opportunity.currency || "BGN",
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
          Back to opportunities
        </Button>
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            {opportunity.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {currentStage && <StageBadge stage={currentStage} />}
            <span className="capitalize">{opportunity.type}</span>
            {opportunity.temperature && (
              <span className="flex items-center gap-1">
                {opportunity.temperature === "hot" && "🔥 Hot"}
                {opportunity.temperature === "warm" && "⚡ Warm"}
                {opportunity.temperature === "cold" && "❄️ Cold"}
              </span>
            )}
            {opportunity.status !== "active" && opportunity.closed_at && (
              <span className="text-destructive font-medium">
                Closed {format(new Date(opportunity.closed_at), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {opportunity.status === "active" && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm font-medium text-muted-foreground">Stage:</span>
              <Select value={opportunity.stage_id} onValueChange={(v) => { if (v) handleStageChange(v); }}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue>
                    {(val) => stages.find((s) => s.id === val)?.name ?? "Select stage"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
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
              Close
            </Button>
          )}

          {opportunity.status !== "active" && (
            <form action={async () => { await reactivateOpportunityAction(opportunity.id); }}>
              <Button type="submit" variant="outline" size="sm">
                Reactivate
              </Button>
            </form>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Info & Notes */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Details
            </h3>
            
            <dl className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="col-span-2">
                <dt className="text-muted-foreground mb-1">Primary Contact</dt>
                <dd className="font-medium text-base">
                  {(() => {
                    const primaryContact = contacts.find(c => c.id === opportunity.primary_contact_id);
                    if (!primaryContact) return "—";
                    return (
                      <Link
                        href={`/contacts/${primaryContact.id}`}
                        className="hover:underline text-primary flex items-center gap-1.5"
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {primaryContact.display_name}
                      </Link>
                    );
                  })()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Expected Value</dt>
                <dd className="font-medium">
                  {opportunity.expected_value
                    ? formatter.format(opportunity.expected_value)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Lead Source</dt>
                <dd className="font-medium">{source?.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Created</dt>
                <dd className="font-medium">
                  {format(new Date(opportunity.created_at), "MMM d, yyyy")}
                </dd>
              </div>
              {opportunity.inquiry_id && (
                <div>
                  <dt className="text-muted-foreground mb-1">Origin</dt>
                  <dd className="font-medium flex items-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Link
                      href={`/inquiries?id=${opportunity.inquiry_id}`}
                      className="hover:underline text-primary"
                    >
                      View Inquiry
                    </Link>
                  </dd>
                </div>
              )}
            </dl>

            {opportunity.notes && (
              <div className="mt-6 pt-6 border-t">
                <dt className="text-muted-foreground text-sm mb-2 font-medium">Notes</dt>
                <dd className="whitespace-pre-wrap text-sm">{opportunity.notes}</dd>
              </div>
            )}

            <div className="mt-6 pt-6 border-t">
              <dt className="text-muted-foreground text-sm mb-4 font-medium">Activity History</dt>
              <OpportunityActivity
                initialTimeline={timeline}
                opportunityId={opportunity.id}
                currentUserId={currentUserId}
              />
            </div>
          </div>

          <ParticipantList
            opportunityId={opportunity.id}
            participants={opportunity.participants}
            contacts={contacts}
            addAction={addParticipantAction}
            removeAction={removeParticipantAction}
          />
        </div>

        {/* Right column: Tasks & Actions */}
        <div className="space-y-6">
          <TaskList
            opportunityId={opportunity.id}
            tasks={tasks}
            brokers={brokers}
            createAction={createTaskAction}
            completeAction={completeTaskAction}
          />
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit opportunity</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            opportunity={opportunity}
            stages={stages}
            leadSources={leadSources}
            contacts={contacts}
            brokers={brokers}
            createAction={async () => ({ success: false, error: "Not used" })}
            updateAction={updateOpportunityAction.bind(null, opportunity.id)}
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
