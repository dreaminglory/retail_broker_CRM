"use client";

import { useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropZone } from "./file-drop-zone";
import { ColumnMappingTable, initialColumnMapping } from "./column-mapping-table";
import { ImportOptionsForm } from "./import-options-form";
import { InquiryImportOptionsForm } from "./inquiry-import-options-form";
import { PropertyImportOptionsForm, type ImportBrokerOption } from "./property-import-options-form";
import { missingRequiredFields } from "@/domain/imports/validation";
import { 
  createImportJobAction, 
  saveImportMappingAction, 
  stageImportRowsAction, 
  validateImportJobAction,
  commitImportBatchAction,
  getPropertyPreviewAction,
  savePropertyImportAreasAction,
  getImportResultAction,
} from "@/app/(dashboard)/settings/import/actions";
import { PropertyImportPreview } from "./property-import-preview";
import type { PropertyPreview } from "@/domain/imports/property-preview";
import { runCommitBatches } from "@/domain/imports/commit-loop";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

import { useTranslations } from "next-intl";

export type ImportWizardEntity = "contact" | "inquiry" | "property";

const TYPE_LABEL_KEY = { contact: "contactsType", inquiry: "inquiriesType", property: "propertiesType" } as const;
const LIST_PATH = { contact: "/contacts", inquiry: "/inquiries", property: "/properties" } as const;

function defaultOptions(entityType: ImportWizardEntity) {
  if (entityType === "inquiry") {
    return {
      unknown_source: "use_default",
      default_source_id: null,
      default_assigned_to: null,
      default_status: "new",
      link_contacts: true,
      create_missing_contacts: false,
    };
  }
  if (entityType === "property") {
    return { duplicate_strategy: "skip", default_assigned_to: null, date_format: "dd.MM.yyyy" };
  }
  return { duplicate_strategy: "skip", default_contact_type: "person" };
}

export function ImportWizard({
  entityType = "contact",
  brokers = [],
}: {
  entityType?: ImportWizardEntity;
  /** Property jobs: the agency's active members, for the default broker. */
  brokers?: ImportBrokerOption[];
}) {
  const t = useTranslations("SettingsImport.wizard");
  const tMapping = useTranslations("SettingsImport.mapping");
  const typeLabel = t(TYPE_LABEL_KEY[entityType]);
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
  const [options, setOptions] = useState<any>(() => defaultOptions(entityType));
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const missingRequired = missingRequiredFields(entityType, mapping);

  // Validation State
  const [summary, setSummary] = useState<any>(null);
  const [propertyPreview, setPropertyPreview] = useState<PropertyPreview | null>(null);
  const [keptAreas, setKeptAreas] = useState<Set<string>>(new Set());
  const [isStaged, setIsStaged] = useState(false);
  // The rows the commit writes: a property job's duplicates too under "create anyway".
  const rowsToCommit =
    entityType === "property" && propertyPreview
      ? propertyPreview.counts.new + (options.duplicate_strategy === "create" ? propertyPreview.counts.duplicate : 0)
      : summary?.valid ?? 0;
  const [result, setResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);

  // Commit State
  const [progress, setProgress] = useState<{ processed: number, remaining: number }>({ processed: 0, remaining: 0 });
  const [commitStopped, setCommitStopped] = useState(false);

  const calculateSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleFileAccepted = async (acceptedFile: File, detectedHeaders: string[], detectedEncoding: 'utf-8' | 'windows-1251', detectedDelimiter: string, detectedSampleRows: string[][]) => {
    try {
      setIsProcessing(true);
      setSampleRows(detectedSampleRows);
      setFile(acceptedFile);
      setHeaders(detectedHeaders);
      setMapping(initialColumnMapping(detectedHeaders, entityType));
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
        toast.error(res.error || t("createFailed"));
        return;
      }
      if (!res.data) {
        toast.error(t("createFailed"));
        return;
      }

      setJobId(res.data.jobId);
      setPreviousJobs(res.data.previousJobs);
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || t("createFailed"));
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
        toast.error(res.error || t("validateFailed"));
        return;
      }

      // Stage rows chunk by chunk
      if (!isStaged) {
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
                  if (!stageRes.success) throw new Error(stageRes.error || t("validateFailed"));
                }
                setIsStaged(true);
                resolve(true);
              } catch (err) {
                reject(err);
              }
            },
            error: (err) => reject(err)
          });
        });
      }

      // Validate
      const validateRes = await validateImportJobAction(jobId);
      if (!validateRes.success) {
        toast.error(validateRes.error || t("validateFailed"));
        return;
      }
      if (!validateRes.data) {
        toast.error(t("validateFailed"));
        return;
      }

      if (entityType === "property") {
        const previewRes = await getPropertyPreviewAction(jobId);
        if (!previewRes.success || !previewRes.data) {
          toast.error((!previewRes.success && previewRes.error) || t("validateFailed"));
          return;
        }
        setPropertyPreview(previewRes.data);
        setKeptAreas(new Set(previewRes.data.newAreas.filter((a) => a.checked).map((a) => a.key)));
      }

      setSummary(validateRes.data);
      setProgress({ processed: 0, remaining: validateRes.data.valid });
      setStep(3);

    } catch (e: any) {
      toast.error(e.message || t("validateFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!jobId) return;
    try {
      setIsProcessing(true);
      if (entityType === "property" && propertyPreview) {
        // Only the ticked new areas are created; the rows of the others import without an area.
        const kept = propertyPreview.newAreas.filter((a) => keptAreas.has(a.key)).map((a) => a.key);
        const saveRes = await savePropertyImportAreasAction(jobId, kept);
        if (!saveRes.success) {
          toast.error(saveRes.error || t("commitFailed"));
          return;
        }
      }
      setStep(4);
      setProgress({ processed: 0, remaining: rowsToCommit });
      await runBatches(rowsToCommit);
    } catch (e: any) {
      toast.error(e.message || t("commitFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 5 only once every batch went through; otherwise stay on step 4 with a retry, since the
  // job is still `committing` and the RPC carries on from the rows left.
  const runBatches = async (remaining: number) => {
    if (!jobId) return;
    setCommitStopped(false);
    const outcome = await runCommitBatches(() => commitImportBatchAction(jobId), remaining, (processed, left) =>
      setProgress((prev) => ({ processed: prev.processed + processed, remaining: left }))
    );
    if (!outcome.done) {
      toast.error(outcome.error || t("commitFailed"));
      setCommitStopped(true);
      return;
    }

    if (entityType === "property") {
      const resultRes = await getImportResultAction(jobId);
      if (resultRes.success && resultRes.data) setResult(resultRes.data);
    }
    setStep(5);
  };

  const handleRetryCommit = async () => {
    try {
      setIsProcessing(true);
      await runBatches(progress.remaining);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">{t("title", { type: typeLabel })}</h1>
        <div className="text-sm text-muted-foreground">{t("stepCount", { step })}</div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step1.title")}</CardTitle>
            <CardDescription>{t("step1.desc", { type: typeLabel })}</CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropZone onFileAccepted={handleFileAccepted} maxSizeMB={5} />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step2.title")}</CardTitle>
            <CardDescription>{t("step2.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {previousJobs.length > 0 && (
              <Alert variant="default" className="bg-yellow-50 text-yellow-900 border-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("step2.previousUploadAlert")}
                </AlertDescription>
              </Alert>
            )}
            <ColumnMappingTable headers={headers} entityType={entityType} sampleRows={sampleRows} mapping={mapping} onChange={setMapping} />
            {missingRequired.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("step2.missingRequired", {
                    fields: missingRequired.map((field) => tMapping(`fields.${field}` as never)).join(", "),
                  })}
                </AlertDescription>
              </Alert>
            )}
            {entityType === "property" ? (
              <PropertyImportOptionsForm options={options} brokers={brokers} onChange={setOptions} />
            ) : entityType === "inquiry" ? (
              <InquiryImportOptionsForm options={options} onChange={setOptions} />
            ) : (
              <ImportOptionsForm options={options} onChange={setOptions} />
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} disabled={isProcessing}>{t("back")}</Button>
            <Button onClick={handleSaveMapping} disabled={isProcessing || Object.keys(mapping).length === 0 || missingRequired.length > 0}>
              {isProcessing ? t("validating") : t("nextReview")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && summary && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step3.title")}</CardTitle>
            <CardDescription>{t("step3.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {entityType === "property" && propertyPreview && jobId ? (
              <PropertyImportPreview
                jobId={jobId}
                preview={propertyPreview}
                duplicateStrategy={options.duplicate_strategy}
                keptAreas={keptAreas}
                onToggleArea={(key, keep) =>
                  setKeptAreas((prev) => {
                    const next = new Set(prev);
                    if (keep) next.add(key);
                    else next.delete(key);
                    return next;
                  })
                }
              />
            ) : (<>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-4 border rounded-md">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-muted-foreground">{t("step3.totalRows")}</div>
              </div>
              <div className="p-4 border rounded-md bg-green-50">
                <div className="text-2xl font-bold text-green-700">{summary.valid}</div>
                <div className="text-sm text-green-700">{t("step3.valid")}</div>
              </div>
              <div className="p-4 border rounded-md bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">{summary.duplicate}</div>
                <div className="text-sm text-yellow-700">{t("step3.duplicates")}</div>
              </div>
              <div className="p-4 border rounded-md bg-red-50">
                <div className="text-2xl font-bold text-red-700">{summary.invalid}</div>
                <div className="text-sm text-red-700">{t("step3.invalid")}</div>
              </div>
            </div>
            {summary.invalid > 0 && (
              <p className="text-sm text-red-600">
                {t("step3.invalidDesc")}
              </p>
            )}
            
            {summary.brokerImpact && summary.brokerImpact.length > 0 && (
              <div className="mt-4 border rounded-md p-4 bg-muted/30">
                <h4 className="text-sm font-semibold mb-2">{t("step3.impactPreview")}</h4>
                <div className="space-y-1">
                  {summary.brokerImpact.map((b: any) => (
                    <div key={b.userId} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{b.name}</span>
                      <span className="font-medium">{t("step3.inquiriesCount", { count: b.newInquiries })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>)}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} disabled={isProcessing}>{t("back")}</Button>
            <Button onClick={handleCommit} disabled={isProcessing || rowsToCommit === 0}>
              {isProcessing ? t("starting") : t("startImport")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step4.title")}</CardTitle>
            <CardDescription>{t("step4.desc", { type: typeLabel })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full bg-secondary h-4 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${Math.max(5, (progress.processed / Math.max(1, rowsToCommit)) * 100)}%` }}
              />
            </div>
            <div className="text-sm text-center text-muted-foreground">
              {t("step4.progress", { processed: progress.processed, total: rowsToCommit })}
            </div>
            {commitStopped && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t("step4.stopped")}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          {commitStopped && (
            <CardFooter className="justify-end">
              <Button onClick={handleRetryCommit} disabled={isProcessing}>
                {isProcessing ? t("starting") : t("step4.resume")}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step5.title")}</CardTitle>
            <CardDescription>{t("step5.desc", { type: typeLabel })}</CardDescription>
          </CardHeader>
          <CardContent>
             <p>{t("step5.success")}</p>
             {result && (
               <p className="mt-2 text-sm text-muted-foreground">
                 {t("step5.result", { created: result.created, skipped: result.skipped, errors: result.errors })}
               </p>
             )}
             {summary.invalid > 0 && (
               <Button variant="link" onClick={() => window.open(`/settings/import/${jobId}/errors.csv`, '_blank')} className="px-0">
                 {t("step5.downloadError")}
               </Button>
             )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push(LIST_PATH[entityType])}>
              {t("step5.goTo", { type: typeLabel })}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
