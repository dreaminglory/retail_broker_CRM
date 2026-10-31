"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { UploadCloud, FileType, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { detectEncoding } from "@/domain/imports/csv/detect-encoding";

interface FileDropZoneProps {
  onFileAccepted: (file: File, headers: string[], encoding: 'utf-8' | 'windows-1251', delimiter: string) => void;
  maxSizeMB?: number;
}

export function FileDropZone({ onFileAccepted, maxSizeMB = 5 }: FileDropZoneProps) {
  const t = useTranslations("SettingsImport.dropzone");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);

    // Size check
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(t("tooLarge", { size: maxSizeMB }));
      return;
    }

    // Type check (basic)
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setError(t("invalidType"));
      return;
    }

    const encoding = detectEncoding(await file.arrayBuffer());

    // Parse just the first few lines to get headers
    Papa.parse<string[]>(file, {
      preview: 5,
      skipEmptyLines: true,
      encoding,
      complete: (results) => {
        if (results.errors.length > 0 && results.errors[0].code === "UndetectableDelimiter") {
          setError(t("noDelimiter"));
          return;
        }

        if (results.data.length === 0) {
          setError(t("empty"));
          return;
        }

        const headers = results.data[0];

        onFileAccepted(file, headers, encoding, results.meta.delimiter || ',');
      },
      error: () => {
        setError(t("parseFailed"));
      }
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("subtitle")}
          </p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            {t("selectFile")}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv, text/csv"
            onChange={handleFileInputChange}
          />
          <p className="text-xs text-muted-foreground mt-4">
            {t("supported", { size: maxSizeMB })}
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
