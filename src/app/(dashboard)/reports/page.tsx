import { getTranslations } from "next-intl/server";

import { ReportsPreview } from "./reports-preview";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("reports") };
}

/** Скоро placeholder (spec ui-bright, phase 4): sample data, no queries, no controls that work. */
export default function ReportsPage() {
  return <ReportsPreview />;
}
