"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Inquiry, InquiryStatus } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import {
  Phone,
  Mail,
  User,
  Clock,
  MoreHorizontal,
  ArrowUpRight,
  MessageSquareOff,
  CheckCheck,
} from "lucide-react";

// ── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  InquiryStatus,
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  contacted: {
    label: "Contacted",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  converted: {
    label: "Converted",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  dismissed: {
    label: "Dismissed",
    className: "bg-muted text-muted-foreground",
  },
};

// ── Simple relative time ──────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface InquiryCardProps {
  inquiry: Inquiry;
  leadSources: LeadSource[];
  onMarkContacted?: (id: string) => void;
  onConvert?: (inquiry: Inquiry) => void;
  onDismiss?: (inquiry: Inquiry) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function InquiryCard({
  inquiry,
  leadSources,
  onMarkContacted,
  onConvert,
  onDismiss,
}: InquiryCardProps) {
  const statusCfg = STATUS_CONFIG[inquiry.status];
  const isTerminal =
    inquiry.status === "converted" || inquiry.status === "dismissed";

  const source = inquiry.source_id
    ? leadSources.find((s) => s.id === inquiry.source_id)
    : null;

  const age = relativeTime(inquiry.received_at);

  const callerDisplay =
    inquiry.caller_name ||
    inquiry.caller_phone ||
    inquiry.caller_email ||
    "Unknown caller";

  return (
    <div className="group relative rounded-lg border bg-card px-4 py-3.5 transition-shadow hover:shadow-sm">
      {/* Top row: avatar + caller + status + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {callerDisplay.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{callerDisplay}</p>
            {inquiry.subject && (
              <p className="truncate text-xs text-muted-foreground">
                {inquiry.subject}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="secondary"
            className={`text-[11px] font-medium px-2 py-0.5 ${statusCfg.className}`}
          >
            {statusCfg.label}
          </Badge>

          {/* Actions dropdown — non-terminal inquiries only */}
          {!isTerminal && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Inquiry actions"
                    id={`inquiry-actions-${inquiry.id}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                {inquiry.status === "new" && onMarkContacted && (
                  <DropdownMenuItem
                    onClick={() => onMarkContacted(inquiry.id)}
                    id={`inquiry-mark-contacted-${inquiry.id}`}
                  >
                    <CheckCheck className="mr-2 h-4 w-4 text-amber-600" />
                    Mark contacted
                  </DropdownMenuItem>
                )}
                {onConvert && (
                  <DropdownMenuItem
                    onClick={() => onConvert(inquiry)}
                    id={`inquiry-convert-${inquiry.id}`}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4 text-emerald-600" />
                    Convert to opportunity
                  </DropdownMenuItem>
                )}
                {onDismiss && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDismiss(inquiry)}
                      id={`inquiry-dismiss-${inquiry.id}`}
                    >
                      <MessageSquareOff className="mr-2 h-4 w-4" />
                      Dismiss
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Contact details row */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-11 text-xs text-muted-foreground">
        {inquiry.caller_phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {inquiry.caller_phone}
          </span>
        )}
        {inquiry.caller_email && (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {inquiry.caller_email}
          </span>
        )}
      </div>

      {/* Bottom meta row */}
      <div className="mt-2 flex items-center justify-between pl-11 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3 flex-wrap">
          {source && (
            <span className="font-medium">{source.name}</span>
          )}
          {inquiry.assigned_to && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Assigned
            </span>
          )}
          {inquiry.dismissed_reason && (
            <span className="italic truncate max-w-[200px]">
              &quot;{inquiry.dismissed_reason}&quot;
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" />
          {age}
        </span>
      </div>
    </div>
  );
}
