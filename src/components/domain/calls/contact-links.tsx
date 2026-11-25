"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { contactLinksFor, type ContactLinkKind } from "@/lib/contact-links";
import type { ContactMethodType } from "@/domain/contacts/types";
import type { CallChannel } from "@/domain/calls/types";
import type { PostCallTarget } from "./post-call-sheet";
import { useCallIntent } from "./use-call-intent";

type ContactLinksProps = {
  /** The stored value: a phone in any format or an email. */
  value: string;
  type: ContactMethodType;
  /** Who the link reaches, for the aria-label. */
  name: string;
  /** Icon plus short label (contact page); icon-only otherwise (cards). */
  showLabels?: boolean;
  /**
   * What a tap logs against (spec phone-loop rule 2). With it, a tap on Call, Viber or WhatsApp
   * is remembered and coming back to the app asks "Did you reach them?" (rule 3).
   */
  callTarget?: Omit<PostCallTarget, "channel">;
  className?: string;
};

/** The channel a tapped link logs; email never prompts by itself (rule 3). */
const CHANNEL: Partial<Record<ContactLinkKind, CallChannel>> = {
  call: "phone",
  viber: "viber",
  whatsapp: "whatsapp",
};

const ICONS: Record<ContactLinkKind, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  viber: MessageCircle,
  whatsapp: MessageCircle,
  email: Mail,
};

/** Lucide has no brand marks; the brand tint tells the two chat buttons apart. */
const ICON_TINT: Partial<Record<ContactLinkKind, string>> = {
  viber: "text-primary",
  whatsapp: "text-primary",
};

/** Call · Viber · WhatsApp · Email as real links (spec phone-loop rule 1, AD-065). */
export function ContactLinks({ value, type, name, showLabels = false, callTarget, className }: ContactLinksProps) {
  const t = useTranslations("phoneLoop.links");
  const intent = useCallIntent();
  const links = contactLinksFor(value, type);
  if (links.length === 0) return null;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {links.map((link) => {
        const Icon = ICONS[link.kind];
        const external = link.href.startsWith("https:");
        const channel = CHANNEL[link.kind];
        const onClick = intent && callTarget && channel ? () => intent.register({ ...callTarget, channel }) : undefined;
        return (
          <a
            key={link.kind}
            href={link.href}
            aria-label={t(`${link.kind}Aria`, { name })}
            title={showLabels ? undefined : t(link.kind)}
            onClick={onClick}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8 md:min-w-8",
              showLabels && "px-3 md:px-2.5",
            )}
          >
            <Icon className={cn("size-4", ICON_TINT[link.kind])} aria-hidden />
            {showLabels && <span className="hidden sm:inline">{t(link.kind)}</span>}
          </a>
        );
      })}
    </span>
  );
}
