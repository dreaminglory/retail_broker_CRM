import { redirect } from "next/navigation";
import { ImportWizard, type ImportWizardEntity } from "@/components/domain/imports/import-wizard";
import { createSupabaseServer } from "@/lib/supabase/server";
import { MemberRepository } from "@/domain/members/repository";

function parseType(type: string | undefined): ImportWizardEntity {
  return type === "inquiry" || type === "property" ? type : "contact";
}

export default async function NewImportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams;
  const type = parseType(params.type);

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Same guard as the import history page: imports are owner/manager only (the actions refuse too).
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership || (membership.role !== "owner" && membership.role !== "manager")) {
    redirect("/settings");
  }

  const brokers = type === "property"
    ? (await new MemberRepository(supabase).getActiveBrokers(membership.agency_id))
        .map((b) => ({ id: b.id, name: b.display_name || b.email }))
    : [];

  return (
    <div className="container py-8 max-w-5xl">
      <ImportWizard entityType={type} brokers={brokers} />
    </div>
  );
}
