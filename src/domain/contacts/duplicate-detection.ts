import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateContactInput, Contact, ContactMethod } from './types';
import { generateDisplayName, normalizeContactMethodValue } from './validation';

export type DuplicateMatchReason = 'phone' | 'email' | 'name';

export interface PotentialDuplicate {
  contact: Contact;
  contact_methods: ContactMethod[];
  match_reasons: DuplicateMatchReason[];
}

export async function findPotentialDuplicates(
  db: SupabaseClient,
  agencyId: string,
  input: CreateContactInput
): Promise<PotentialDuplicate[]> {
  const duplicates = new Map<string, PotentialDuplicate>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addMatch = (contact: any, reason: DuplicateMatchReason) => {
    if (duplicates.has(contact.id)) {
      const existing = duplicates.get(contact.id)!;
      if (!existing.match_reasons.includes(reason)) {
        existing.match_reasons.push(reason);
      }
    } else {
      duplicates.set(contact.id, {
        contact: {
          id: contact.id,
          agency_id: contact.agency_id,
          type: contact.type,
          first_name: contact.first_name,
          last_name: contact.last_name,
          company_name: contact.company_name,
          display_name: contact.display_name,
          notes: contact.notes,
          status: contact.status,
          created_by: contact.created_by,
          external_ref: contact.external_ref ?? null,
          import_job_id: contact.import_job_id ?? null,
          created_at: contact.created_at,
          updated_at: contact.updated_at,
        },
        contact_methods: contact.contact_methods || [],
        match_reasons: [reason],
      });
    }
  };

  // 1. Check contact methods (phone/email)
  const allMethodValues = (input.contact_methods || [])
    .map((m) => normalizeContactMethodValue(m.type, m.value))
    .filter(Boolean);

  if (allMethodValues.length > 0) {
    const { data: methodMatches } = await db
      .from('contact_methods')
      .select('contact_id, type')
      .eq('agency_id', agencyId)
      .in('value', allMethodValues);

    if (methodMatches && methodMatches.length > 0) {
      const contactIds = [...new Set(methodMatches.map((m) => m.contact_id))];
      const { data: contacts } = await db
        .from('contacts')
        .select('*, contact_methods(*)')
        .eq('agency_id', agencyId)
        .in('id', contactIds)
        .eq('status', 'active'); // Only active duplicates

      if (contacts) {
        for (const c of contacts) {
          const matchedMethods = methodMatches.filter((m) => m.contact_id === c.id);
          for (const m of matchedMethods) {
            const reason = m.type === 'email' ? 'email' : 'phone';
            addMatch(c, reason);
          }
        }
      }
    }
  }

  // 2. Check name similarity
  const displayName = generateDisplayName(input.type, {
    first_name: input.first_name,
    last_name: input.last_name,
    company_name: input.company_name,
  });

  if (
    displayName &&
    displayName.length >= 3 &&
    displayName !== 'Unnamed Contact' &&
    displayName !== 'Unnamed Organization'
  ) {
    // Trigram-accelerated ILIKE
    const { data: nameMatches } = await db
      .from('contacts')
      .select('*, contact_methods(*)')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .ilike('display_name', `%${displayName}%`);

    if (nameMatches) {
      for (const c of nameMatches) {
        addMatch(c, 'name');
      }
    }
  }

  // Rank: most reasons first
  return Array.from(duplicates.values()).sort(
    (a, b) => b.match_reasons.length - a.match_reasons.length
  );
}
