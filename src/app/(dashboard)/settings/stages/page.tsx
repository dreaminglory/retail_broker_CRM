import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { CONFIG_ROLES } from '@/lib/actions';
import { StageService } from '@/domain/stages/service';
import { StagesSettingsClient } from './stages-settings-client';
import { ChevronLeft } from 'lucide-react';

async function getMembership(): Promise<{ agency_id: string; role: string } | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('agency_memberships')
    .select('agency_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  return membership ?? null;
}

import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("stages") };
}


export default async function StagesSettingsPage() {
  const t = await getTranslations("SettingsStages");
  const supabase = await createSupabaseServer();
  const membership = await getMembership();
  // Configuration is owner/manager only (AD-045).
  if (!membership || !(CONFIG_ROLES as readonly string[]).includes(membership.role)) redirect('/settings');
  const agencyId = membership.agency_id;

  const stages = agencyId
    ? await new StageService(supabase).list(agencyId)
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("settings")}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <StagesSettingsClient initialStages={stages} />
    </div>
  );
}
