import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { StageService } from '@/domain/stages/service';
import { StagesSettingsClient } from './stages-settings-client';
import { ChevronLeft } from 'lucide-react';

async function getAgencyId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('agency_memberships')
    .select('agency_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  return membership?.agency_id ?? null;
}

export default async function StagesSettingsPage() {
  const supabase = await createSupabaseServer();
  const agencyId = await getAgencyId();

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
          Settings
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Pipeline Stages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your opportunity pipeline — add, rename, reorder, or delete stages.
          Terminal stages (Won, Lost, Nurture) close opportunities.
        </p>
      </div>

      <StagesSettingsClient initialStages={stages} />
    </div>
  );
}
