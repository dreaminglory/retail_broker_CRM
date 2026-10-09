import { NextRequest, NextResponse } from "next/server";
import { ImportService } from "@/domain/imports/service";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServer();
    
    // We do basic auth check. RLS handles the rest (agency isolation).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Role check is better done via a helper, but since ImportService uses RLS,
    // and only owners/managers have SELECT access to import_jobs via RLS,
    // if a broker tries to access this, getJob will return null.

    const service = new ImportService(supabase);
    const csvContent = await service.buildErrorReportCsv("", id); // agencyId is technically not needed here if RLS protects it, but we can pass user's agency.
    // Actually our repository uses .eq("agency_id", agencyId). We need the agencyId.
    // Let's fetch it.
    const { data: membership } = await supabase
      .from("agency_memberships")
      .select("agency_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
      
    if (!membership) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    if (membership.role !== "owner" && membership.role !== "manager") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const finalCsv = await service.buildErrorReportCsv(membership.agency_id, id);

    return new NextResponse(finalCsv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import_errors_${id}.csv"`,
      },
    });
  } catch (err: any) {
    if (err.message === "import.errors.notFound") {
      return new NextResponse("Not Found", { status: 404 });
    }
    console.error("Error generating CSV report", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
