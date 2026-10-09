"use server";

/**
 * Today Screen Server Actions.
 * Handles the "complete → schedule next" workflow and data fetching.
 */

import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

import { TaskService } from "@/domain/tasks/service";
import type { CompleteTaskWithNextInput, Task } from "@/domain/tasks/types";
import type { AtRiskOpportunity } from "@/domain/tasks/repository";
import { InquiryService } from "@/domain/inquiries/service";
import type { Inquiry } from "@/domain/inquiries/types";
import { getAgencySettings } from "@/domain/agencies/settings";

// ── Today Screen Data ─────────────────────────────────────────────────────

export interface TodayScreenData {
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
  atRisk: AtRiskOpportunity[];
  newInquiries: Inquiry[];
}

export async function getTodayScreenData(): Promise<ActionResult<TodayScreenData>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();
    const settings = await getAgencySettings(agencyId);
    const taskService = new TaskService(supabase);
    const inquiryService = new InquiryService(supabase);

    const [overdue, dueToday, upcoming, atRisk, newInquiries] = await Promise.all([
      taskService.listOverdue(agencyId, userId),
      taskService.listDueToday(agencyId, userId, settings.timezone),
      taskService.listUpcoming(agencyId, userId, settings.timezone),
      taskService.listAtRisk(agencyId, userId),
      inquiryService.list(agencyId, { status: "new", assignedTo: userId }),
    ]);

    return {
      success: true,
      data: { overdue, dueToday, upcoming, atRisk, newInquiries },
    };
  } catch (error) { return toActionError(error); }
}

// ── Quick Complete (with next action workflow) ─────────────────────────────

export async function quickCompleteTaskAction(
  taskId: string,
  input: CompleteTaskWithNextInput
): Promise<ActionResult<{ completedTask: Task; nextTask?: Task }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();
    const taskService = new TaskService(supabase);
    const result = await taskService.completeWithNext(taskId, agencyId, userId, input);
    return { success: true, data: result };
  } catch (error) { return toActionError(error); }
}

// ── Today Screen Counts (for dashboard summary) ───────────────────────────

export interface TodayCounts {
  overdue: number;
  dueToday: number;
  upcoming: number;
  atRisk: number;
  newInquiries: number;
}

export async function getTodayCounts(): Promise<ActionResult<TodayCounts>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();
    const settings = await getAgencySettings(agencyId);
    const taskService = new TaskService(supabase);
    const inquiryService = new InquiryService(supabase);

    const [overdue, dueToday, upcoming, atRisk, newInquiries] = await Promise.all([
      taskService.listOverdue(agencyId, userId),
      taskService.listDueToday(agencyId, userId, settings.timezone),
      taskService.listUpcoming(agencyId, userId, settings.timezone),
      taskService.listAtRisk(agencyId, userId),
      inquiryService.list(agencyId, { status: "new", assignedTo: userId }),
    ]);

    return {
      success: true,
      data: {
        overdue: overdue.length,
        dueToday: dueToday.length,
        upcoming: upcoming.length,
        atRisk: atRisk.length,
        newInquiries: newInquiries.length,
      },
    };
  } catch (error) { return toActionError(error); }
}
