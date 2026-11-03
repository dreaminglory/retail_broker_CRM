"use server";

import { revalidatePath } from 'next/cache';
import { AreaService } from '@/domain/areas/service';
import type { Area } from '@/domain/areas/types';
import { ListingService } from '@/domain/listings/service';
import type { ListingStatus } from '@/domain/listings/types';
import {
  createListingSchema,
  setListingStatusSchema,
  updateListingPriceSchema,
} from '@/domain/listings/validation';
import { PropertyPartyService } from '@/domain/property-parties/service';
import { addPropertyPartySchema } from '@/domain/property-parties/validation';
import { PropertyService } from '@/domain/properties/service';
import { propertyFormSchema } from '@/domain/properties/validation';
import { CONFIG_ROLES, getAuthContext, requireRole, toActionError, type ActionResult } from '@/lib/actions';
import { z } from 'zod';

function propertyFormValues(formData: FormData) {
  const field = (name: string) => formData.get(name) ?? undefined;
  return {
    type: field('type'),
    rooms: field('rooms'),
    area_m2: field('area_m2'),
    plot_m2: field('plot_m2'),
    floor: field('floor'),
    floors_total: field('floors_total'),
    construction: field('construction'),
    year_built: field('year_built'),
    settlement_id: field('settlement_id'),
    area_id: field('area_id'),
    address: field('address'),
    location_note: field('location_note'),
    description: field('description'),
    assigned_to: field('assigned_to'),
  };
}

export async function createPropertyAction(
  _prevState: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, agencyId, userId } = await getAuthContext();
    const parsed = propertyFormSchema.safeParse(propertyFormValues(formData));
    if (!parsed.success) return toActionError(parsed.error);

    const property = await new PropertyService(supabase).create(agencyId, userId, parsed.data);
    revalidatePath('/properties');
    return { success: true, data: { id: property.id } };
  } catch (error) { return toActionError(error); }
}

export async function updatePropertyAction(
  id: string,
  _prevState: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const parsed = propertyFormSchema.safeParse(propertyFormValues(formData));
    if (!parsed.success) return toActionError(parsed.error);

    await new PropertyService(supabase).update(id, agencyId, parsed.data);
    revalidateProperty(id);
    return { success: true, data: { id } };
  } catch (error) { return toActionError(error); }
}

/** Any member (rule 1); archiving withdraws open listings. */
export async function setPropertyArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    await new PropertyService(supabase).setArchived(id, agencyId, archived);
    revalidateProperty(id);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

/** Owner/manager only (T2); refused for a property in use. */
export async function deletePropertyAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    requireRole(ctx, CONFIG_ROLES);
    await new PropertyService(ctx.supabase).delete(id, ctx.agencyId);
    revalidatePath('/properties');
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

// ── Listings (rule 4) ───────────────────────────────────────────────────────

function revalidateProperty(propertyId: string) {
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/properties');
}

export async function createListingAction(
  propertyId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase, agencyId, userId } = await getAuthContext();
    const parsed = createListingSchema.safeParse({
      property_id: propertyId,
      offer_type: formData.get('offer_type'),
      price: formData.get('price'),
    });
    if (!parsed.success) return toActionError(parsed.error);

    await new ListingService(supabase).create(agencyId, userId, parsed.data);
    revalidateProperty(propertyId);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function changeListingPriceAction(
  listingId: string,
  propertyId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const parsed = updateListingPriceSchema.safeParse({ price: formData.get('price') });
    if (!parsed.success) return toActionError(parsed.error);

    await new ListingService(supabase).changePrice(listingId, agencyId, parsed.data);
    revalidateProperty(propertyId);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function setListingStatusAction(
  listingId: string,
  propertyId: string,
  status: ListingStatus,
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const parsed = setListingStatusSchema.safeParse({ status });
    if (!parsed.success) return toActionError(parsed.error);

    await new ListingService(supabase).setStatus(listingId, agencyId, parsed.data);
    revalidateProperty(propertyId);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

// ── Parties ─────────────────────────────────────────────────────────────────

export async function addPropertyPartyAction(
  propertyId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase, agencyId, userId } = await getAuthContext();
    const parsed = addPropertyPartySchema.safeParse({
      property_id: propertyId,
      contact_id: formData.get('contact_id') || undefined,
      role: formData.get('role'),
    });
    if (!parsed.success) return toActionError(parsed.error);

    await new PropertyPartyService(supabase).add(agencyId, userId, parsed.data);
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath(`/contacts/${parsed.data.contact_id}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function endPropertyPartyAction(partyId: string, propertyId: string): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const party = await new PropertyPartyService(supabase).end(partyId, agencyId);
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath(`/contacts/${party.contact_id}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

/** The active areas of a settlement, for the property form's area select. */
export async function listAreasForSettlementAction(settlementId: string): Promise<ActionResult<Pick<Area, 'id' | 'name'>[]>> {
  try {
    const parsed = z.string().uuid().safeParse(settlementId);
    if (!parsed.success) return toActionError(parsed.error);
    const { supabase, agencyId } = await getAuthContext();
    const areas = await new AreaService(supabase).listActiveForSettlement(agencyId, parsed.data);
    return { success: true, data: areas.map(({ id, name }) => ({ id, name })) };
  } catch (error) { return toActionError(error); }
}
