import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ImportService } from "@/domain/imports/service";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { RevertImportButton } from "./revert-import-button";

export default async function ImportHistoryPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || (membership.role !== "owner" && membership.role !== "manager")) {
    redirect("/settings");
  }

  // Unfortunately the listJobs function uses the repository which is currently internal to the service,
  // Let's instantiate the service and get the list directly using supabase.
  // Wait, I didn't expose listJobs in ImportService. I'll just query it directly.
  
  const { data: jobs } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("agency_id", membership.agency_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import History</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            View past imports or start a new one.
          </p>
        </div>
        <Link href="/settings/import/new?type=contact">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Import
          </Button>
        </Link>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Imported</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!jobs || jobs.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No imports found.
                </TableCell>
              </TableRow>
            )}
            {jobs?.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {job.file_name}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {job.entity_type}
                </TableCell>
                <TableCell>
                  {format(new Date(job.created_at), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    job.status === 'completed' ? 'default' : 
                    job.status === 'reverted' ? 'outline' :
                    job.status === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {job.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{job.total_rows}</TableCell>
                <TableCell className="text-right text-green-600 font-medium">
                  {job.created_count}
                </TableCell>
                <TableCell className="text-right">
                  {job.status === "completed" && differenceInDays(new Date(), new Date(job.created_at)) <= 7 && (
                    <RevertImportButton jobId={job.id} fileName={job.file_name} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
