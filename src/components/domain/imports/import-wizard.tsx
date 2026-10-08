"use client";

import { useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropZone } from "./file-drop-zone";
import { ColumnMappingTable } from "./column-mapping-table";
import { ImportOptionsForm } from "./import-options-form";
import { InquiryImportOptionsForm } from "./inquiry-import-options-form";
import { ContactImportOptionsInput, InquiryImportOptionsInput } from "@/domain/imports/validation";
import { 
  createImportJobAction, 
  saveImportMappingAction, 
  stageImportRowsAction, 
  validateImportJobAction,
  commitImportBatchAction
} from "@/app/(dashboard)/settings/import/actions";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function ImportWizard({ entityType = "contact" }: { entityType?: "contact" | "inquiry" }) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Job State
  const [jobId, setJobId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [encoding, setEncoding] = useState<'utf-8' | 'windows-1251'>('utf-8');
  const [delimiter, setDelimiter] = useState<string>(',');
  const [previousJobs, setPreviousJobs] = useState<any[]>([]);
  
  // Mapping State
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [options, setOptions] = useState<any>(
    entityType === "inquiry"
      ? {
          unknown_source: "use_default",
          default_source_id: null,
          default_assigned_to: null,
          default_status: "new",
          link_contacts: true,
          create_missing_contacts: false,
        }
      : {
          duplicate_strategy: "skip",
          default_contact_type: "person",
        }
  );

  // Validation State
  const [summary, setSummary] = useState<any>(null);

  // Commit State
  const [progress, setProgress] = useState<{ processed: number, remaining: number }>({ processed: 0, remaining: 0 });

  const calculateSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleFileAccepted = async (acceptedFile: File, detectedHeaders: string[], detectedEncoding: 'utf-8' | 'windows-1251', detectedDelimiter: string) => {
    try {
      setIsProcessing(true);
      setFile(acceptedFile);
      setHeaders(detectedHeaders);
      setEncoding(detectedEncoding);
      setDelimiter(detectedDelimiter);

      const hash = await calculateSha256(acceptedFile);

      const res = await createImportJobAction({
        file_name: acceptedFile.name,
        file_sha256: hash,
        file_size_bytes: acceptedFile.size,
        encoding: detectedEncoding,
        delimiter: detectedDelimiter,
        headers: detectedHeaders,
        entity_type: entityType
      });

      if (!res.success) {
        toast.error(res.error || "Failed to create import job");
        return;
      }
      if (!res.data) {
        toast.error("Failed to create import job (no data returned)");
        return;
      }

      setJobId(res.data.jobId);
      setPreviousJobs(res.data.previousJobs);
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!jobId || !file) return;

    try {
      setIsProcessing(true);
      const res = await saveImportMappingAction(jobId, mapping, options);
      if (!res.success) {
        toast.error(res.error || "Failed to save mapping");
        return;
      }

      // Stage rows chunk by chunk
      // We read the entire file using PapaParse since it's < 5MB and < 5000 rows
      await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          encoding: encoding,
          complete: async (results) => {
            try {
              const rows = results.data as Record<string, string>[];
              const chunkSize = 500;
              for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const stageRes = await stageImportRowsAction(jobId, { startRow: i + 1, rows: chunk });
                if (!stageRes.success) throw new Error(stageRes.error || "Failed to stage rows");
              }
              resolve(true);
            } catch (err) {
              reject(err);
            }
          },
          error: (err) => reject(err)
        });
      });

      // Validate
      const validateRes = await validateImportJobAction(jobId);
      if (!validateRes.success) {
        toast.error(validateRes.error || "Failed to validate");
        return;
      }
      if (!validateRes.data) {
        toast.error("Failed to validate (no data)");
        return;
      }

      setSummary(validateRes.data);
      setProgress({ processed: 0, remaining: validateRes.data.valid });
      setStep(3);

    } catch (e: any) {
      toast.error(e.message || "An error occurred during mapping and validation");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!jobId) return;
    try {
      setIsProcessing(true);
      setStep(4);
      
      let currentRemaining = summary.valid;
      while (currentRemaining > 0) {
        const res = await commitImportBatchAction(jobId);
        if (!res.success) {
          toast.error(res.error || "Commit failed");
          break;
        }
        if (!res.data) {
          toast.error("Commit failed (no data)");
          break;
        }
        setProgress(prev => ({ processed: prev.processed + res.data!.processed, remaining: res.data!.remaining }));
        currentRemaining = res.data.remaining;
      }

      setStep(5);
    } catch (e: any) {
      toast.error(e.message || "An error occurred during commit");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Import {entityType === "inquiry" ? "Inquiries" : "Contacts"}</h1>
        <div className="text-sm text-muted-foreground">Step {step} of 5</div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>Select a CSV file to import {entityType === "inquiry" ? "inquiries" : "contacts"} from.</CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropZone onFileAccepted={handleFileAccepted} maxSizeMB={5} />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>Map the columns from your CSV to CRM fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {previousJobs.length > 0 && (
              <Alert variant="default" className="bg-yellow-50 text-yellow-900 border-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This file was previously uploaded. Re-importing it with "Skip duplicates" will not create duplicates.
                </AlertDescription>
              </Alert>
            )}
            <ColumnMappingTable headers={headers} onChange={setMapping} />
            {entityType === "inquiry" ? (
              <InquiryImportOptionsForm options={options} onChange={setOptions} />
            ) : (
              <ImportOptionsForm options={options} onChange={setOptions} />
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} disabled={isProcessing}>Back</Button>
            <Button onClick={handleSaveMapping} disabled={isProcessing || Object.keys(mapping).length === 0}>
              {isProcessing ? "Validating..." : "Next: Review"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && summary && (
        <Card>
          <CardHeader>
            <CardTitle>Review Validation</CardTitle>
            <CardDescription>Review the results before importing data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-4 border rounded-md">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="p-4 border rounded-md bg-green-50">
                <div className="text-2xl font-bold text-green-700">{summary.valid}</div>
                <div className="text-sm text-green-700">Valid</div>
              </div>
              <div className="p-4 border rounded-md bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">{summary.duplicate}</div>
                <div className="text-sm text-yellow-700">Duplicates</div>
              </div>
              <div className="p-4 border rounded-md bg-red-50">
                <div className="text-2xl font-bold text-red-700">{summary.invalid}</div>
                <div className="text-sm text-red-700">Invalid</div>
              </div>
            </div>
            {summary.invalid > 0 && (
              <p className="text-sm text-red-600">
                Invalid rows will be skipped. You can download an error report later to fix them.
              </p>
            )}
            
            {summary.brokerImpact && summary.brokerImpact.length > 0 && (
              <div className="mt-4 border rounded-md p-4 bg-muted/30">
                <h4 className="text-sm font-semibold mb-2">Impact Preview (New on Today Screen)</h4>
                <div className="space-y-1">
                  {summary.brokerImpact.map((b: any) => (
                    <div key={b.userId} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{b.name}</span>
                      <span className="font-medium">+{b.newInquiries} inquiries</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} disabled={isProcessing}>Back</Button>
            <Button onClick={handleCommit} disabled={isProcessing || summary.valid === 0}>
              {isProcessing ? "Starting..." : "Start Import"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Importing...</CardTitle>
            <CardDescription>Please wait while we import your {entityType === "inquiry" ? "inquiries" : "contacts"}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full bg-secondary h-4 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${Math.max(5, (progress.processed / summary.valid) * 100)}%` }}
              />
            </div>
            <div className="text-sm text-center text-muted-foreground">
              {progress.processed} of {summary.valid} rows imported
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
            <CardDescription>Your {entityType === "inquiry" ? "inquiries" : "contacts"} have been successfully imported.</CardDescription>
          </CardHeader>
          <CardContent>
             <p>The import process finished successfully.</p>
             {summary.invalid > 0 && (
               <Button variant="link" onClick={() => window.open(`/settings/import/${jobId}/errors.csv`, '_blank')} className="px-0">
                 Download Error Report
               </Button>
             )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push(entityType === "inquiry" ? "/inquiries" : "/contacts")}>
              Go to {entityType === "inquiry" ? "Inquiries" : "Contacts"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
