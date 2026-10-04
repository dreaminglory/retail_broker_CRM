"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { SearchService } from "@/domain/search/service";
import type { SearchResult } from "@/domain/search/types";

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return [];

  const searchService = new SearchService(supabase);
  return searchService.globalSearch(membership.agency_id, query);
}
