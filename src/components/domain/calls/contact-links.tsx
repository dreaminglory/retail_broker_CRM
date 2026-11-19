"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { contactLinksFor, type ContactLinkKind } from "@/lib/contact-links";
import type { ContactMethodType } from "@/domain/contacts/types";

type ContactLinksProps = {
  /** The stored value: a phone in any format or an email. */
  value: string;
  type: ContactMethodType;
  /** Who the link reaches, for the aria-label. */
  name: string;
  /** Icon plus short label (contact page); icon-only otherwise (cards). */
  showLabels?: boolean;
  /** Called on tap, before the browser follows the link (call intent, T7). */
  onTap?: (kind: ContactLinkKind) => void;
  className?: string;
};

const ICONS: Record<ContactLinkKind, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  viber: MessageCircle,
  whatsapp: MessageCircle,
  email: Mail,
};

/** Lucide has no brand marks; the brand tint tells the two chat buttons apart. */
const ICON_TINT: Partial<Record<ContactLinkKind, string>> = {
  viber: "text-violet-600 dark:text-violet-400",
  whatsapp: "text-emerald-600 dark:text-emerald-400",
};

/** Call · Viber · WhatsApp · Email as real links (spec phone-loop rule 1, AD-065). */
export function ContactLinks({ value, type, name, showLabels = false, onTap, className }: ContactLinksProps) {
  const t = useTranslations("phoneLoop.links");
  const links = contactLinksFor(value, type);
  if (links.length === 0) return null;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {links.map((link) => {
        const Icon = ICONS[link.kind];
        const external = link.href.startsWith("https:");
        return (
          <a
            key={link.kind}
            href={link.href}
            aria-label={t(`${link.kind}Aria`, { name })}
            title={showLabels ? undefined : t(link.kind)}
            onClick={onTap ? () => onTap(link.kind) : undefined}
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
