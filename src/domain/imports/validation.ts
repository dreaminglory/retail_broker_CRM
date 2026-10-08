import { z } from "zod";

export const IMPORT_LIMITS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_ROWS: 5000,
  MAX_HEADERS: 100,
  MAX_CHUNK_ROWS: 500,
  MAX_CELL_LENGTH: 5000,
};

export const createImportJobSchema = z.object({
  file_name: z.string().min(1, { message: "import.errors.fileNameRequired" }),
  file_sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/, { message: "import.errors.invalidHash" }),
  file_size_bytes: z
    .number()
    .min(1, { message: "import.errors.emptyFile" })
    .max(IMPORT_LIMITS.MAX_FILE_SIZE_BYTES, {
      message: "import.errors.fileTooLarge",
    }),
  encoding: z.enum(["utf-8", "windows-1251"], {
    errorMap: () => ({ message: "import.errors.invalidEncoding" }),
  }),
  delimiter: z.enum([",", ";", "\t", "|"], {
    errorMap: () => ({ message: "import.errors.invalidDelimiter" }),
  }),
  entity_type: z.enum(["contact", "inquiry"]).default("contact"),
  headers: z
    .array(z.string())
    .max(IMPORT_LIMITS.MAX_HEADERS, { message: "import.errors.tooManyHeaders" }),
});

export type CreateImportJobInput = z.infer<typeof createImportJobSchema>;

export const contactMappingSchema = z
  .record(z.string().nullable())
  .refine(
    (mapping) => {
      // Must map at least one name-related field
      return (
        mapping.full_name ||
        mapping.first_name ||
        mapping.last_name ||
        mapping.company_name
      );
    },
    { message: "import.errors.missingNameMapping", path: ["full_name"] }
  )
  .refine(
    (mapping) => {
      // Must map at least one identifier (phone, email, or a name field is usually minimum for a contact)
      // Actually, plan says: at least one identifier among names, phone or email. 
      // The previous refine checks name. This refine is basically redundant or we can ensure there is at least one contact method if name is missing? 
      // Actually, plan: "at least one of full_name/first_name/last_name/company_name, and at least one identifier among names, phone or email".
      // Wait, if name is mapped, it's an identifier. If it just requires one of them, then just name is enough? Yes.
      return true;
    },
    { message: "import.errors.missingIdentifierMapping" }
  );

export type ContactMappingInput = z.infer<typeof contactMappingSchema>;

export const contactImportOptionsSchema = z.object({
  duplicate_strategy: z.enum(["skip", "update", "create"]).default("skip"),
  default_contact_type: z.enum(["person", "organization"]).default("person"),
});

export type ContactImportOptionsInput = z.infer<typeof contactImportOptionsSchema>;

export const stageRowsSchema = z.object({
  startRow: z.number().int().min(1),
  rows: z
    .array(z.record(z.string().max(IMPORT_LIMITS.MAX_CELL_LENGTH)))
    .max(IMPORT_LIMITS.MAX_CHUNK_ROWS, { message: "import.errors.chunkTooLarge" }),
});

export type StageRowsInput = z.infer<typeof stageRowsSchema>;

export const inquiryMappingSchema = z
  .record(z.string().nullable())
  .refine(
    (mapping) => {
      return !!(
        mapping.caller_name ||
        mapping.caller_phone ||
        mapping.caller_email ||
        mapping.subject ||
        mapping.description
      );
    },
    { message: "import.errors.missingInquiryMapping", path: ["caller_name"] }
  );

export type InquiryMappingInput = z.infer<typeof inquiryMappingSchema>;

export const inquiryImportOptionsSchema = z.object({
  default_source_id: z.string().uuid().nullable().optional(),
  unknown_source: z.enum(["use_default", "error"]).default("use_default"),
  default_assigned_to: z.string().uuid().nullable().optional(),
  default_status: z.string().default("new"),
  link_contacts: z.boolean().default(true),
  create_missing_contacts: z.boolean().default(false),
  date_format: z.string().optional(),
});

export type InquiryImportOptionsInput = z.infer<typeof inquiryImportOptionsSchema>;
