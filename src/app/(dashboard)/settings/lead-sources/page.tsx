import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CONFIG_ROLES, hasRole } from "@/lib/roles";
import { getCurrentMembership } from "@/lib/membership";
import { LeadSourceService } from "@/domain/lead-sources/service";
import { LeadSourceListClient } from "./lead-source-list-client";
import { ChevronLeft } from "lucide-react";

import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadSources") };
}


export default async function LeadSourcesPage() {
  const t = await getTranslations("SettingsLeadSources");
  const supabase = await createSupabaseServer();
  const membership = await getCurrentMembership();
  // Configuration is owner/manager only (AD-045).
  if (!membership || !hasRole(membership.role, CONFIG_ROLES)) redirect("/settings");
  const leadSources = await new LeadSourceService(supabase).listAll(membership.agencyId);

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
