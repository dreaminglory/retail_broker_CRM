import { DomainError } from "@/lib/errors";
/**
 * Inquiry service.
 * Enforces status transition rules and the convert-to-opportunity flow.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { InquiryRepository } from './repository';
import type { Inquiry, CreateInquiryInput, UpdateInquiryInput } from './types';
import {
  createInquirySchema,
  updateInquirySchema,
  dismissInquirySchema,
  convertInquirySchema,
  editInquirySchemaFor,
  callerContactMethods,
  INQUIRY_STATUS_TRANSITIONS,
} from './validation';
import type { ConvertInquirySchema } from './validation';
import { OpportunityRepository } from '../opportunities/repository';
import { generateDisplayName } from '../contacts/validation';
import { findPotentialDuplicates, type PotentialDuplicate } from '../contacts/duplicate-detection';
import { MemberRepository } from '../members/repository';
import type { InquiryListOptions } from './repository';

export class InquiryService {
  private readonly db: SupabaseClient;
  private readonly repo: InquiryRepository;
  private readonly opportunityRepo: OpportunityRepository;

  constructor(db: SupabaseClient) {
    this.db = db;
    this.repo = new InquiryRepository(db);
    this.opportunityRepo = new OpportunityRepository(db);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async list(agencyId: string, opts?: InquiryListOptions): Promise<Inquiry[]> {
    return this.repo.findAll(agencyId, opts);
  }

  async listPage(
    agencyId: string,
    opts?: InquiryListOptions
  ): Promise<{ rows: Inquiry[]; total: number }> {
    return this.repo.findPage(agencyId, opts);
  }

  async getById(id: string, agencyId: string): Promise<Inquiry | null> {
    return this.repo.findById(id, agencyId);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Creates a new inquiry (manual entry). Status defaults to 'new'. */
  async create(
    agencyId: string,
    userId: string,
    input: CreateInquiryInput
  ): Promise<Inquiry> {
    const parsed = createInquirySchema.parse(input);
    await this.assertAssignable(agencyId, parsed.assigned_to);
    return this.repo.create(agencyId, userId, parsed as CreateInquiryInput);
  }

  /** Updates mutable fields on an inquiry. Does NOT advance status. */
  async update(
    id: string,
    agencyId: string,
    input: UpdateInquiryInput
  ): Promise<Inquiry> {
    const parsed = updateInquirySchema.parse(input);

    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');

    // Converted and dismissed inquiries are closed: nothing on them changes from here (I3).
    if (INQUIRY_STATUS_TRANSITIONS[current.status].length === 0) {
      throw new DomainError('errors.inquiries.final_state');
    }

    // Enforce status transition rules if status is being changed
    if (parsed.status) this.assertValidTransition(current.status, parsed.status);

    await this.assertAssignable(agencyId, parsed.assigned_to, current.assigned_to);

    return this.repo.update(id, agencyId, parsed as UpdateInquiryInput);
  }

  /** Applies a person's edit. A stored phone the edit leaves unchanged isn't validated or rewritten. */
  async edit(id: string, agencyId: string, input: unknown): Promise<Inquiry> {
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');

    const { caller_phone: callerPhone, ...rest } = editInquirySchemaFor(current.caller_phone).parse(input);
    return this.update(id, agencyId, {
      ...rest,
      ...(callerPhone !== current.caller_phone && { caller_phone: callerPhone }),
    });
  }

  /** Marks the inquiry as 'contacted'. */
  async markContacted(id: string, agencyId: string): Promise<Inquiry> {
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');
    this.assertValidTransition(current.status, 'contacted');
    return this.repo.update(id, agencyId, { status: 'contacted' });
  }

  /** Dismisses an inquiry with an optional reason. Terminal — cannot revert. */
  async dismiss(
    id: string,
    agencyId: string,
    input: { dismissed_reason?: string | null }
  ): Promise<Inquiry> {
    const parsed = dismissInquirySchema.parse(input);
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');
    this.assertValidTransition(current.status, 'dismissed');
    return this.repo.update(id, agencyId, {
      status: 'dismissed',
      dismissed_reason: parsed.dismissed_reason ?? null,
    });
  }

  /**
   * Finds contacts that a conversion would duplicate, matching the new contact's name
   * and the caller's phone and email (FR-INQ-14).
   */
  async findConversionDuplicates(
    id: string,
    agencyId: string,
    newContact: NonNullable<ConvertInquirySchema['create_contact']>
  ): Promise<PotentialDuplicate[]> {
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');

    return findPotentialDuplicates(this.db, agencyId, {
      ...newContact,
      contact_methods: callerContactMethods(current),
    });
  }

  /**
   * Converts an inquiry to an opportunity (FR-INQ-07).
   * Optionally creates a new contact or links an existing one.
   * Sets inquiry status to 'converted' — terminal.
   */
  async convert(
    id: string,
    agencyId: string,
    userId: string,
    input: ConvertInquirySchema
  ): Promise<{ inquiryId: string; opportunityId: string; contactId: string | null }> {
    const parsed = convertInquirySchema.parse(input);

    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');
    this.assertValidTransition(current.status, 'converted');
    await this.assertAssignable(agencyId, parsed.assigned_to, current.assigned_to);

    let contactId: string | null = parsed.contact_id ?? null;

    // Create a new contact from inquiry data if requested
    if (parsed.create_contact) {
      const displayName = generateDisplayName(parsed.create_contact.type, {
        first_name: parsed.create_contact.first_name ?? current.caller_name?.split(' ')[0],
        last_name: parsed.create_contact.last_name ?? current.caller_name?.split(' ').slice(1).join(' '),
        company_name: parsed.create_contact.company_name,
      });

      const { data: newContact, error: contactError } = await this.db
        .from('contacts')
        .insert({
          agency_id: agencyId,
          type: parsed.create_contact.type,
          first_name: parsed.create_contact.first_name ?? current.caller_name?.split(' ')[0] ?? null,
          last_name: parsed.create_contact.last_name ?? (current.caller_name?.split(' ').slice(1).join(' ') || null),
          company_name: parsed.create_contact.company_name ?? null,
          display_name: displayName,
          created_by: userId,
        })
        .select()
        .single();

      if (contactError) throw new DomainError('errors.inquiries.contact_creation_failed', `Failed to create contact: ${contactError.message}`);
      contactId = (newContact as { id: string }).id;

      // Seed contact methods from caller info if available
      const methods = callerContactMethods(current).map((method) => ({
        ...method,
        contact_id: contactId,
        agency_id: agencyId,
      }));
      if (methods.length > 0) {
        await this.db
          .from('contact_methods')
          .insert(methods);
      }
    }

    // Create the opportunity
    const opportunity = await this.opportunityRepo.create(agencyId, userId, {
      title: parsed.opportunity_title,
      type: parsed.opportunity_type,
      stage_id: parsed.stage_id,
      inquiry_id: id,
      primary_contact_id: contactId,
      assigned_to: parsed.assigned_to ?? current.assigned_to ?? null,
      source_id: current.source_id,
    });

    // Mark inquiry as converted and link back
    await this.repo.update(id, agencyId, {
      status: 'converted',
      contact_id: contactId,
      opportunity_id: opportunity.id,
    });

    return { inquiryId: id, opportunityId: opportunity.id, contactId };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertValidTransition(from: string, to: string): void {
    const allowed = INQUIRY_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new DomainError(
        'errors.inquiries.invalid_transition',
        `Invalid status transition: '${from}' → '${to}'. ` +
        `Allowed: [${allowed.join(', ') || 'none'}]`
      );
    }
  }

  /**
   * A new assignee must be an active member of the agency (AD-049). Leaving a deactivated
   * assignee in place is allowed, so editing other fields doesn't force a reassign.
   */
  private async assertAssignable(
    agencyId: string,
    assignedTo: string | null | undefined,
    currentAssignee: string | null = null
  ): Promise<void> {
    if (!assignedTo || assignedTo === currentAssignee) return;
    if (!(await new MemberRepository(this.db).isActiveMember(agencyId, assignedTo))) {
      throw new DomainError('errors.inquiries.assignee_not_member');
    }
  }
}
