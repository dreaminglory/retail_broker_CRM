import { getAgencySettings } from "@/domain/agencies/settings";
import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Building2,
  AlertTriangle,
  Clock,
  Inbox,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { TaskService } from "@/domain/tasks/service";
import { getTranslations } from "next-intl/server";
import { InquiryService } from "@/domain/inquiries/service";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("dashboard") };
}


export default async function DashboardPage() {
  const t = await getTranslations('Dashboard');
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName =
    user?.user_metadata?.full_name ?? user?.email ?? "there";

  // Get agency info
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("role, agency_id, agencies(name)")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single();

  const agencyData = membership?.agencies as unknown as { name: string } | null;
  const agencyId = membership?.agency_id ?? "";

  // Fetch Today counts
  const settings = await getAgencySettings(agencyId);
  const taskService = new TaskService(supabase, { timezone: settings.timezone });
  const inquiryService = new InquiryService(supabase);

  const [{ overdue, dueToday }, atRisk, newInquiries] = await Promise.all([
    taskService.listToday(agencyId, user!.id),
    taskService.listAtRisk(agencyId, user!.id),
    inquiryService.list(agencyId, { status: "new", assignedTo: user!.id }),
  ]);

  const totalUrgent = overdue.length + newInquiries.length;
  const totalToday = dueToday.length;
  const totalAtRisk = atRisk.length;

  const todayCount = totalUrgent + totalToday;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header (dashboard.png): title and the workspace line. */}
      <div className="mb-6">
        <h1 className="text-title text-ink">
          {t('welcome', { name: fullName.split(' ')[0] })}
        </h1>
        <p className="mt-1 text-body text-muted-foreground">
          {t('workspaceReady', { agency: agencyData?.name ?? t('yourAgency') })}
          {membership?.role === 'owner' && t('ownerNotice')}
        </p>
      </div>

      {/* The four real counts as KPI tiles; each opens Today. */}
      <section aria-labelledby="dashboard-today" className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="dashboard-today" className="text-section text-ink">{t('todayWorkTitle')}</h2>
          <Link href="/today" className="flex items-center gap-1 text-body text-primary hover:underline">
            {todayCount > 0
              ? (todayCount === 1 ? t('todayItem', { count: 1 }) : t('todayItems', { count: todayCount }))
              : t('caughtUp')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <KpiTile
            icon={<AlertTriangle className="size-4" />}
            label={t('overdue')}
            count={overdue.length}
            tone={overdue.length > 0 ? "overdue" : "neutral"}
          />
          <KpiTile
            icon={<Inbox className="size-4" />}
            label={t('newInquiries')}
            count={newInquiries.length}
            tone="neutral"
          />
          <KpiTile
            icon={<Clock className="size-4" />}
            label={t('dueToday')}
            count={totalToday}
            tone={totalToday > 0 ? "due" : "neutral"}
          />
          <KpiTile
            icon={<Briefcase className="size-4" />}
            label={t('atRisk')}
            count={totalAtRisk}
            tone={totalAtRisk > 0 ? "atRisk" : "neutral"}
          />
        </div>
      </section>

      {/* Quick links */}
      <h3 className="mb-3 text-label uppercase text-muted-foreground">{t('quickActions')}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Inbox,
            title: t('actions.inquiriesTitle'),
            description: t('actions.inquiriesDesc'),
            href: "/inquiries",
          },
          {
            icon: Briefcase,
            title: t('actions.opportunitiesTitle'),
            description: t('actions.opportunitiesDesc'),
            href: "/opportunities",
          },
          {
            icon: Building2,
            title: t('actions.contactsTitle'),
            description: t('actions.contactsDesc'),
            href: "/contacts",
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group rounded-lg border border-border bg-surface p-5 transition-colors hover:border-info-line focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="flex items-center justify-between">
              <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <h4 className="mt-3 text-body-strong text-ink">{item.title}</h4>
            <p className="mt-1 text-body text-muted-foreground">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** A KPI tile (dashboard.png): label, a large tabular number; status colour only for follow-up. */
function KpiTile({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "neutral" | "overdue" | "due" | "atRisk";
}) {
  return (
    <Link
      href="/today"
      className={cn(
        "block rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tone === "overdue" ? "border-overdue/40 bg-overdue-soft" : "border-border bg-surface hover:border-info-line"
      )}
    >
      <span className="flex items-center gap-1.5 text-label uppercase text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "mt-2 block text-num-lg tabular-nums",
          tone === "overdue" ? "text-overdue" : tone === "due" ? "text-due-ink" : tone === "atRisk" ? "text-at-risk-ink" : "text-ink"
        )}
      >
        {count}
      </span>
    </Link>
  );
}
