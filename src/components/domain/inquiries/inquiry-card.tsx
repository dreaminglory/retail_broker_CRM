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
import type { ActiveBroker } from "@/domain/members/types";
import Link from "next/link";
import {
  Phone,
  Mail,
  User,
  Clock,
  MoreHorizontal,
  ArrowUpRight,
  MessageSquareOff,
  CheckCheck,
  Pencil,
  PhoneCall,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRelativeTime } from "@/lib/i18n/use-relative-time";
import { ContactLinks } from "@/components/domain/calls/contact-links";
import type { PostCallTarget } from "@/components/domain/calls/post-call-sheet";
import { InquiryCallLine } from "./inquiry-call-line";

// ── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  InquiryStatus,
  { className: string }
> = {
  new: {
    className: "bg-accent text-primary",
  },
  contacted: {
    className:
      "bg-muted text-ink",
  },
  converted: {
    className:
      "bg-done-soft text-done",
  },
  dismissed: {
    className: "bg-muted text-muted-foreground",
  },
};

// ── Simple relative time ──────────────────────────────────────────────────────


// ── Props ────────────────────────────────────────────────────────────────────

interface InquiryCardProps {
  inquiry: Inquiry;
  leadSources: LeadSource[];
  brokers: ActiveBroker[];
  /** Names of assignees who are no longer active, by user id. */
  inactiveAssigneeNames: Record<string, string>;
  /** Set when this converted inquiry joined an existing deal instead of starting one. */
  joinedDeal?: { id: string; title: string };
  onEdit?: (inquiry: Inquiry) => void;
  onMarkContacted?: (id: string) => void;
  onConvert?: (inquiry: Inquiry) => void;
  onDismiss?: (inquiry: Inquiry) => void;
  /** "Log call" by hand (spec phone-loop rule 4); also on converted and dismissed inquiries. */
  onLogCall?: (inquiry: Inquiry) => void;
  /** The agency's timezone; with it the card shows the contact time and calls (rule 9). */
  timeZone?: string;
  /** Inside the inquiries panel: no card edge of its own. */
  flat?: boolean;
}

/**
 * What a call on this inquiry logs against (spec phone-loop rules 2 and 8): a tapped link and
 * "Log call" share it. A display name, never the number (rule 12).
 */
export function inquiryCallTarget(inquiry: Inquiry, unknownCaller: string): Omit<PostCallTarget, "channel"> {
  return {
    context: { inquiry_id: inquiry.id },
    name: inquiry.caller_name || unknownCaller,
    noRetry: inquiry.status === "dismissed",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function InquiryCard({
  inquiry,
  leadSources,
  brokers,
  inactiveAssigneeNames,
  joinedDeal,
  onEdit,
  onMarkContacted,
  onConvert,
  onDismiss,
  onLogCall,
  timeZone,
  flat = false,
}: InquiryCardProps) {
  const t = useTranslations("InquiryCard");
  const tCall = useTranslations("phoneLoop");
  const ago = useRelativeTime();

  const statusCfg = STATUS_CONFIG[inquiry.status];
  const isTerminal =
    inquiry.status === "converted" || inquiry.status === "dismissed";

  const source = inquiry.source_id
    ? leadSources.find((s) => s.id === inquiry.source_id)
    : null;

  const receivedAt = new Date(inquiry.received_at);
  const age = ago(receivedAt);

  const assigneeName = inquiry.assigned_to
    ? brokers.find((b) => b.id === inquiry.assigned_to)?.display_name ??
      inactiveAssigneeNames[inquiry.assigned_to]
    : undefined;

  const callTarget = inquiryCallTarget(inquiry, t("unknownCaller"));

  const callerDisplay =
    inquiry.caller_name ||
    inquiry.caller_phone ||
    inquiry.caller_email ||
    t("unknownCaller");

  return (
    <div
      className={
        flat
          ? "group relative px-4 py-4"
          : "group relative rounded-lg border bg-card px-4 py-3.5 transition-colors hover:border-info-line"
      }
    >
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
          {inquiry.import_job_id && (
            <Link href="/settings/import">
              <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground border-muted-foreground/30 hover:bg-muted" title={t("importedBadge")}>
                {t("importedBadge")}
              </Badge>
            </Link>
          )}
          <Badge
            variant="secondary"
            className={`text-[11px] font-medium px-2 py-0.5 ${statusCfg.className}`}
          >
            {t(`status.${inquiry.status}`)}
          </Badge>

          {/* Actions dropdown: every action on an open inquiry, "Log call" on any (rule 8) */}
          {(!isTerminal || onLogCall) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    aria-label={t("actions")}
                    id={`inquiry-actions-${inquiry.id}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                {onLogCall && (
                  <DropdownMenuItem
                    onClick={() => onLogCall(inquiry)}
                    id={`inquiry-log-call-${inquiry.id}`}
                  >
                    <PhoneCall className="mr-2 h-4 w-4" />
                    {tCall("logCall")}
                  </DropdownMenuItem>
                )}
                {!isTerminal && onEdit && (
                  <DropdownMenuItem
                    onClick={() => onEdit(inquiry)}
                    id={`inquiry-edit-${inquiry.id}`}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("edit")}
                  </DropdownMenuItem>
                )}
                {inquiry.status === "new" && onMarkContacted && (
                  <DropdownMenuItem
                    onClick={() => onMarkContacted(inquiry.id)}
                    id={`inquiry-mark-contacted-${inquiry.id}`}
                  >
                    <CheckCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                    {t("markContacted")}
                  </DropdownMenuItem>
                )}
                {!isTerminal && onConvert && (
                  <DropdownMenuItem
                    onClick={() => onConvert(inquiry)}
                    id={`inquiry-convert-${inquiry.id}`}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4 text-muted-foreground" />
                    {t("convertToOpportunity")}
                  </DropdownMenuItem>
                )}
                {!isTerminal && onDismiss && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDismiss(inquiry)}
                      id={`inquiry-dismiss-${inquiry.id}`}
                    >
                      <MessageSquareOff className="mr-2 h-4 w-4" />
                      {t("dismiss")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Contact details row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-xs text-muted-foreground">
        {inquiry.caller_phone && (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {inquiry.caller_phone}
            </span>
            <ContactLinks value={inquiry.caller_phone} type="phone" name={callerDisplay} callTarget={callTarget} />
          </span>
        )}
        {inquiry.caller_email && (
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{inquiry.caller_email}</span>
            </span>
            <ContactLinks value={inquiry.caller_email} type="email" name={callerDisplay} />
          </span>
        )}
      </div>

      {timeZone && <InquiryCallLine inquiry={inquiry} timeZone={timeZone} />}

      {/* Bottom meta row */}
      <div className="mt-2 flex items-center justify-between pl-11 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3 flex-wrap">
          {source && (
            <span className="font-medium">{source.name}</span>
          )}
          {inquiry.assigned_to && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {assigneeName ?? t("assigned")}
            </span>
          )}
          {joinedDeal && (
            <Link
              href={`/opportunities/${joinedDeal.id}`}
              className="flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
            >
              <ArrowUpRight className="h-3 w-3" />
              {t("joinedTo", { title: joinedDeal.title })}
            </Link>
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
