"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { UploadCloud, FileType, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FileDropZoneProps {
  onFileAccepted: (file: File, headers: string[], encoding: 'utf-8' | 'windows-1251', delimiter: string) => void;
  maxSizeMB?: number;
}

export function FileDropZone({ onFileAccepted, maxSizeMB = 5 }: FileDropZoneProps) {
  const t = useTranslations("SettingsImport.dropzone");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [encoding, setEncoding] = useState<'utf-8' | 'windows-1251'>('utf-8');

  const processFile = async (file: File, forcedEncoding?: 'utf-8' | 'windows-1251') => {
    setError(null);

    // Size check
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    // Type check (basic)
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      return;
    }

    const currentEncoding = forcedEncoding || encoding;

    // Parse just the first few lines to get headers
    Papa.parse<string[]>(file, {
      preview: 5,
      skipEmptyLines: true,
      encoding: currentEncoding,
      complete: (results) => {
        if (results.errors.length > 0 && results.errors[0].code === "UndetectableDelimiter") {
          setError("Could not detect delimiter. Please ensure the file is a valid CSV.");
          return;
        }

        if (results.data.length === 0) {
          setError("The file appears to be empty.");
          return;
        }

        const headers = results.data[0];
        
        // Basic check for windows-1251 if utf-8 was used and we see weird characters
        // A very simple heuristic: if headers contain the replacement character 
        if (!forcedEncoding && currentEncoding === 'utf-8' && headers.some(h => h.includes(''))) {
          setEncoding('windows-1251');
          processFile(file, 'windows-1251');
          return;
        }

        onFileAccepted(file, headers, currentEncoding, results.meta.delimiter || ',');
      },
      error: (err) => {
        setError(`Failed to parse file: ${err.message}`);
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
