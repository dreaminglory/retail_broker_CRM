import { Suspense } from "react";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { LeadSourceService } from "@/domain/lead-sources/service";
import { LeadSourceListClient } from "./lead-source-list-client";
import { ChevronLeft } from "lucide-react";

async function getAgencyId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  return membership?.agency_id ?? null;
}

import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadSources") };
}


export default async function LeadSourcesPage() {
  const t = await getTranslations("SettingsLeadSources");
  const supabase = await createSupabaseServer();
  const agencyId = await getAgencyId();

  const leadSources = agencyId
    ? await new LeadSourceService(supabase).listAll(agencyId)
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

      <Suspense fallback={null}>
        <LeadSourceListClient leadSources={leadSources} />
      </Suspense>
    </div>
  );
}
