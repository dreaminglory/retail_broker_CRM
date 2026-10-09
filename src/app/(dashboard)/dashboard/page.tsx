import { getAgencySettings } from "@/domain/agencies/settings";
import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  AlertTriangle,
  Clock,
  Inbox,
  Briefcase,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { TaskService } from "@/domain/tasks/service";
import { getTranslations } from "next-intl/server";
import { InquiryService } from "@/domain/inquiries/service";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agencyData = membership?.agencies as unknown as { name: string } | null;
  const agencyId = membership?.agency_id ?? "";

  // Fetch Today counts
  const taskService = new TaskService(supabase);
  const inquiryService = new InquiryService(supabase);
  const settings = await getAgencySettings(agencyId);

  const [overdue, dueToday, atRisk, newInquiries] = await Promise.all([
    taskService.listOverdue(agencyId, user!.id),
    taskService.listDueToday(agencyId, user!.id, settings.timezone),
    taskService.listAtRisk(agencyId, user!.id),
    inquiryService.list(agencyId, { status: "new", assignedTo: user!.id }),
  ]);

  const totalUrgent = overdue.length + newInquiries.length;
  const totalToday = dueToday.length;
  const totalAtRisk = atRisk.length;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('welcome', { name: fullName.split(' ')[0] })}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t('workspaceReady', { agency: agencyData?.name ?? 'Your agency' })}
          {membership?.role === 'owner' && t('ownerNotice')}
        </p>
      </div>

      {/* Today's work summary */}
      <Link
        href="/today"
        className="mb-8 block rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <CalendarCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{t('todayWorkTitle')}</h2>
              <p className="text-sm text-muted-foreground">
                {totalUrgent + totalToday > 0
                  ? (totalUrgent + totalToday === 1 ? t('todayItem', { count: 1 }) : t('todayItems', { count: totalUrgent + totalToday }))
                  : t('caughtUp')}
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <CountCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label={t('overdue')}
            count={overdue.length}
            color={overdue.length > 0 ? "text-destructive" : "text-muted-foreground"}
          />
          <CountCard
            icon={<Inbox className="h-4 w-4" />}
            label={t('newInquiries')}
            count={newInquiries.length}
            color={newInquiries.length > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}
          />
          <CountCard
            icon={<Clock className="h-4 w-4" />}
            label={t('dueToday')}
            count={totalToday}
            color={totalToday > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}
          />
          <CountCard
            icon={<Briefcase className="h-4 w-4" />}
            label={t('atRisk')}
            count={totalAtRisk}
            color={totalAtRisk > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}
          />
        </div>
      </Link>

      {/* Quick links */}
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t('quickActions')}</h3>
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
            className="group rounded-lg border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
          >
            <div className="flex items-center justify-between">
              <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <h4 className="mt-3 font-semibold">{item.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CountCard({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 p-3 text-center">
      <div className={`flex items-center justify-center gap-1.5 ${color} mb-1`}>
        {icon}
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
