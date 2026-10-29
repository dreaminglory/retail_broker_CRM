/**
 * Loads the Today Screen for a signed-in member. Throws on query errors, so
 * the page's error boundary shows them; Server Actions wrap it in ActionResult.
 */

import type { AuthContext } from '@/lib/actions';
import { hasRole, MANAGER_ROLES } from '@/lib/roles';
import { TaskService } from "@/domain/tasks/service";
import type { Task } from "@/domain/tasks/types";
import type { AtRiskOpportunity } from "@/domain/tasks/repository";
import { InquiryService } from "@/domain/inquiries/service";
import type { Inquiry } from "@/domain/inquiries/types";
import { getAgencySettings } from "@/domain/agencies/settings";

export type TodayScope = "mine" | "agency";

export interface TodayScreenData {
  scope: TodayScope;
  /** The agency's timezone, for the UI's Intl formatting. */
  timeZone: string;
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
  atRisk: AtRiskOpportunity[];
  newInquiries: Inquiry[];
}

/** Owners and managers can switch Today to the whole agency (AD-044). */
export function canSwitchTodayScope(role: string): boolean {
  return hasRole(role, MANAGER_ROLES);
}

/**
 * AD-044: brokers see their own work. Owners and managers see their own by
 * default and everyone's with `scope = 'agency'`.
 */
export async function loadTodayScreenData(
  { supabase, userId, agencyId, role }: AuthContext,
  requested?: string
): Promise<TodayScreenData> {
  const scope: TodayScope = requested === "agency" && canSwitchTodayScope(role) ? "agency" : "mine";
  const assignedTo = scope === "mine" ? userId : undefined;

  const { timezone } = await getAgencySettings(agencyId);
  const taskService = new TaskService(supabase, { timezone });
  const inquiryService = new InquiryService(supabase);

  const [tasks, atRisk, newInquiries] = await Promise.all([
    taskService.listToday(agencyId, assignedTo),
    taskService.listAtRisk(agencyId, assignedTo),
    inquiryService.list(agencyId, { status: "new", assignedTo }),
  ]);

  return { scope, timeZone: timezone, ...tasks, atRisk, newInquiries };
}
