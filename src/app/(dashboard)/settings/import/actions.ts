"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';
import { ImportService } from "@/domain/imports/service";
import { 
  createImportJobSchema, 
  contactMappingSchema, 
  contactImportOptionsSchema,
  inquiryMappingSchema,
  inquiryImportOptionsSchema,
  stageRowsSchema 
} from "@/domain/imports/validation";
import { ImportRepository } from "@/domain/imports/repository";

function assertManagerOrOwner(role: string) {
  if (role !== "owner" && role !== "manager") {
    throw new Error("import.errors.forbidden");
  }
}

export async function createImportJobAction(
  input: unknown
): Promise<ActionResult<{ jobId: string; previousJobs: any[] }>> {
  try {
    const ctx = await getAuthContext();
    assertManagerOrOwner(ctx.role);

    const parsed = createImportJobSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new ImportService(ctx.supabase);
    const data = await service.createJob(ctx.agencyId, parsed.data);

    return { success: true, data };
  } catch (error) { return toActionError(error); }
}

export async function saveImportMappingAction(
  jobId: string,
  mappingInput: unknown,
  optionsInput: unknown
): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    assertManagerOrOwner(ctx.role);

    const repo = new ImportRepository(ctx.supabase);
    const job = await repo.getJob(ctx.agencyId, jobId);
    if (!job) {
      return { success: false, error: "import.errors.notFound" };
    }

    let parsedMapping;
    let parsedOptions;

    if (job.entity_type === "inquiry") {
      parsedMapping = inquiryMappingSchema.safeParse(mappingInput);
      parsedOptions = inquiryImportOptionsSchema.safeParse(optionsInput);
    } else {
      parsedMapping = contactMappingSchema.safeParse(mappingInput);
      parsedOptions = contactImportOptionsSchema.safeParse(optionsInput);
    }

    if (!parsedMapping.success) {
      return { success: false, error: "import.errors.invalidMapping" };
    }
    if (!parsedOptions.success) {
      return { success: false, error: "import.errors.invalidOptions" };
    }

    const service = new ImportService(ctx.supabase);
    await service.saveMapping(ctx.agencyId, jobId, parsedMapping.data, parsedOptions.data);

    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function stageImportRowsAction(
  jobId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    assertManagerOrOwner(ctx.role);

    const parsed = stageRowsSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new ImportService(ctx.supabase);
    await service.stageRows(ctx.agencyId, jobId, parsed.data);

    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function validateImportJobAction(
  jobId: string
): Promise<ActionResult<any>> {
  try {
    const ctx = await getAuthContext();
    assertManagerOrOwner(ctx.role);

    const service = new ImportService(ctx.supabase);
    const summary = await service.validate(ctx.agencyId, jobId);

    return { success: true, data: summary };
  } catch (error) { return toActionError(error); }
}

export async function commitImportBatchAction(
  jobId: string
): Promise<ActionResult<{ processed: number; remaining: number }>> {
  try {
    const ctx = await getAuthContext();
    assertManagerOrOwner(ctx.role);

    const service = new ImportService(ctx.supabase);
    const result = await service.commitBatch(ctx.agencyId, jobId);

    if (result.remaining === 0) {
      revalidatePath("/contacts");
      revalidatePath("/inquiries");
      revalidatePath("/");
    }

    return { success: true, data: result };
  } catch (error) { return toActionError(error); }
}

export async function revertImportJobAction(
  jobId: string
): Promise<ActionResult<{ deleted: number; retained: number }>> {
  try {
    const ctx = await getAuthContext();
    assertManagerOrOwner(ctx.role);

    const service = new ImportService(ctx.supabase);
    const result = await service.revert(ctx.agencyId, jobId);

    revalidatePath("/contacts");
    revalidatePath("/inquiries");
    revalidatePath("/");
    revalidatePath("/settings/import");

    return { success: true, data: result };
  } catch (error) { return toActionError(error); }
}
