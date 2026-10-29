"use server";

/**
 * Today Screen data. Task mutations are shared with the opportunity page
 * (`opportunities/[id]/tasks/actions.ts`).
 */

import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';
import { hasRole } from '@/lib/roles';

import { TaskService } from "@/domain/tasks/service";
import type { Task } from "@/domain/tasks/types";
import type { AtRiskOpportunity } from "@/domain/tasks/repository";
import { InquiryService } from "@/domain/inquiries/service";
import type { Inquiry } from "@/domain/inquiries/types";
import { getAgencySettings } from "@/domain/agencies/settings";

// ── Today Screen Data ─────────────────────────────────────────────────────

export type TodayScope = "mine" | "agency";

export interface TodayScreenData {
  scope: TodayScope;
  timezone: string;
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
  atRisk: AtRiskOpportunity[];
  newInquiries: Inquiry[];
}

/**
 * AD-044: brokers see their own work. Owners and managers see their own by
 * default and everyone's with `scope = 'agency'`.
 */
export async function getTodayScreenData(requested?: string): Promise<ActionResult<TodayScreenData>> {
  try {
    const { supabase, userId, agencyId, role } = await getAuthContext();
    const scope: TodayScope =
      requested === "agency" && hasRole(role, ["owner", "manager"]) ? "agency" : "mine";
    const assignedTo = scope === "mine" ? userId : undefined;

    const { timezone } = await getAgencySettings(agencyId);
    const taskService = new TaskService(supabase, { timezone });
    const inquiryService = new InquiryService(supabase);

    const [tasks, atRisk, newInquiries] = await Promise.all([
      taskService.listToday(agencyId, assignedTo),
      taskService.listAtRisk(agencyId, assignedTo),
      inquiryService.list(agencyId, { status: "new", assignedTo }),
    ]);

    return {
      success: true,
      data: { scope, timezone, ...tasks, atRisk, newInquiries },
    };
  } catch (error) { return toActionError(error); }
}
