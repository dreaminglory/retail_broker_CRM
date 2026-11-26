import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CONFIG_ROLES, hasRole } from "@/lib/roles";
import { getCurrentMembership } from "@/lib/membership";
import { PortalsPreview } from "./portals-preview";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("portals") };
}

/** Скоро placeholder (spec ui-bright, phase 4). Configuration is owner/manager only (AD-045). */
export default async function PortalsSettingsPage() {
  const membership = await getCurrentMembership();
  if (!membership || !hasRole(membership.role, CONFIG_ROLES)) redirect("/settings");
  return <PortalsPreview />;
}
