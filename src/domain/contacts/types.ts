/**
 * Contact domain types.
 * AD-008: Person + Organization types supported from Sprint 1.
 * AD-010: Phone stored as free text — no E.164 enforcement.
 */

export type ContactType = 'person' | 'organization';
export type ContactStatus = 'active' | 'archived';
export type ContactMethodType = 'phone' | 'email' | 'viber' | 'whatsapp' | 'other';

export interface ContactMethod {
  id: string;
  contact_id: string;
  agency_id: string;
  type: ContactMethodType;
  /** Free text — no format enforcement (AD-010). */
  value: string;
  label: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  agency_id: string;
  type: ContactType;
  /** Required for persons. */
  first_name: string | null;
  /** Required for persons. */
  last_name: string | null;
  /** Required for organizations; optional affiliation for persons. */
  company_name: string | null;
  /**
   * Computed display name:
   *  - person → first_name + last_name (whichever parts are set)
   *  - organization → company_name
   */
  display_name: string;
  notes: string | null;
  status: ContactStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Contact with its associated contact methods. */
export interface ContactWithMethods extends Contact {
  contact_methods: ContactMethod[];
}

/** Input for creating a new contact. */
export interface CreateContactInput {
  type: ContactType;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  notes?: string | null;
  /** At least one method is recommended but not enforced at DB level. */
  contact_methods?: Omit<ContactMethod, 'id' | 'contact_id' | 'agency_id' | 'created_at'>[];
}

/** Input for updating a contact. */
export interface UpdateContactInput {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  notes?: string | null;
  status?: ContactStatus;
}

/** Input for adding a contact method. */
export interface AddContactMethodInput {
  type: ContactMethodType;
  value: string;
  label?: string | null;
  is_primary?: boolean;
}
