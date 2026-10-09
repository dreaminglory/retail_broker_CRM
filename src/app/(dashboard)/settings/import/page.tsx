import { redirect } from "next/navigation";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("import") };
}
import { createSupabaseServer } from "@/lib/supabase/server";
import { ImportService } from "@/domain/imports/service";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { differenceInDays } from "date-fns";
import { getTranslations } from "next-intl/server";
import { getFormatter } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { RevertImportButton } from "./revert-import-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default async function ImportHistoryPage() {
  const t = await getTranslations("SettingsImport");
  const formatLoc = await getFormatter();
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
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("newImport")}
            </Button>
          }>
            <Plus className="mr-2 h-4 w-4" />
            {t("newImport")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={
              <Link href="/settings/import/new?type=contact" className="w-full">
                {t("importContacts")}
              </Link>
            }>
              {t("importContacts")}
            </DropdownMenuItem>
            <DropdownMenuItem render={
              <Link href="/settings/import/new?type=inquiry" className="w-full">
                {t("importInquiries")}
              </Link>
            }>
              {t("importInquiries")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.fileName")}</TableHead>
              <TableHead>{t("columns.type")}</TableHead>
              <TableHead>{t("columns.date")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="text-right">{t("columns.rows")}</TableHead>
              <TableHead className="text-right">{t("columns.imported")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!jobs || jobs.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {t("noImports")}
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
                  {formatLoc.dateTime(new Date(job.created_at), { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
