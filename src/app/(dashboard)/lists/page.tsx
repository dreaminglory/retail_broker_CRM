import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/actions";
import { SmartListService } from "@/domain/smart-lists/service";
import { ListOverviewView } from "@/components/domain/smart-lists/list-overview";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("lists") };
}

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;

  // Only a missing session or membership means "sign in"; any other failure
  // reaches the error boundary.
  let ctx: AuthContext;
  try {
    ctx = await getAuthContext();
  } catch {
    redirect("/login");
  }

  const overview = await new SmartListService(ctx.supabase).overview(ctx, scope);
  return <ListOverviewView {...overview} />;
}
