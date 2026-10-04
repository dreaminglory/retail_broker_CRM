"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { ContactMergeService } from "@/domain/contacts/merge";
import { ContactRepository } from "@/domain/contacts/repository";
import { revalidatePath } from "next/cache";

export async function getMergePreviewAction(winnerId: string, loserId: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: membership } = await supabase
    .from('agency_memberships')
    .select('agency_id')
    .eq('user_id', user.id)
    .single();
    
  if (!membership) throw new Error("Unauthorized");
  
  const mergeService = new ContactMergeService(supabase);
  return mergeService.getPreview(membership.agency_id, winnerId, loserId);
}

export async function mergeContactsAction(winnerId: string, loserId: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: membership } = await supabase
    .from('agency_memberships')
    .select('agency_id')
    .eq('user_id', user.id)
    .single();
    
  if (!membership) throw new Error("Unauthorized");
  
  const mergeService = new ContactMergeService(supabase);
  await mergeService.merge(membership.agency_id, user.id, winnerId, loserId);
  
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${winnerId}`);
}

export async function searchContactsForMergeAction(search: string, currentContactId: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: membership } = await supabase
    .from('agency_memberships')
    .select('agency_id')
    .eq('user_id', user.id)
    .single();
    
  if (!membership) throw new Error("Unauthorized");
  
  const repo = new ContactRepository(supabase);
  const contacts = await repo.findAll(membership.agency_id, { search, limit: 10, status: 'active' });
  
  // Filter out the current contact
  return contacts.filter(c => c.id !== currentContactId);
}
