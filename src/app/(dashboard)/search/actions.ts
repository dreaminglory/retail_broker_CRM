"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { toActionError, type ActionResult } from "@/lib/actions";
import { SearchService } from "@/domain/search/service";
import type { SearchResult } from "@/domain/search/types";

export async function globalSearchAction(query: string): Promise<ActionResult<SearchResult[]>> {
  try {
    if (!query || query.trim().length < 2) return { success: true, data: [] };

    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: true, data: [] };

    const { data: membership } = await supabase
      .from("agency_memberships")
      .select("agency_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) return { success: true, data: [] };

    const searchService = new SearchService(supabase);
    return { success: true, data: await searchService.globalSearch(membership.agency_id, query) };
  } catch (error) {
    return toActionError(error);
  }
}
