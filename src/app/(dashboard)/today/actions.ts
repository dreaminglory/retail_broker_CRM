"use server";

/**
 * Today Screen data. Task mutations are shared with the opportunity page
 * (`opportunities/[id]/tasks/actions.ts`).
 */

import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';
import { loadTodayScreenData, type TodayScreenData } from './today-data';

export async function getTodayScreenData(requested?: string): Promise<ActionResult<TodayScreenData>> {
  try {
    const ctx = await getAuthContext();
    return { success: true, data: await loadTodayScreenData(ctx, requested) };
  } catch (error) { return toActionError(error); }
}
