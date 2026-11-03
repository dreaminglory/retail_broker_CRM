import { z } from 'zod';
import type { PartyRole } from './types';

export const PARTY_ROLES = ['owner', 'co_owner', 'representative', 'occupant'] as const satisfies readonly PartyRole[];

export const addPropertyPartySchema = z.object({
  property_id: z.string().uuid(),
  contact_id: z.string({ required_error: 'validation.contact_required' }).uuid('validation.contact_required'),
  role: z.enum(PARTY_ROLES, { errorMap: () => ({ message: 'validation.party_role_required' }) }),
});

export type AddPropertyPartyInput = z.input<typeof addPropertyPartySchema>;
