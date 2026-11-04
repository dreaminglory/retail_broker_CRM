"use server";

import { getLocale } from 'next-intl/server';
import { SettlementService } from '@/domain/settlements/service';
import type { Settlement } from '@/domain/settlements/types';
import { settlementQuerySchema } from '@/domain/settlements/validation';
import type { Locale } from '@/i18n/config';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

/** The settlement picker's search: names in the request locale (rule 9). */
export async function searchSettlementsAction(query: string): Promise<ActionResult<Settlement[]>> {
  try {
    const parsed = settlementQuerySchema.safeParse(query);
    if (!parsed.success) return toActionError(parsed.error);
    const { supabase } = await getAuthContext();
    const locale = (await getLocale()) as Locale;
    return { success: true, data: await new SettlementService(supabase).search(parsed.data, locale) };
  } catch (error) { return toActionError(error); }
}
