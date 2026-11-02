import { DomainError, rpcFailure } from "@/lib/errors";
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
import { generateDisplayName } from '../contacts/validation';
import { findPotentialDuplicates, type PotentialDuplicate } from '../contacts/duplicate-detection';
import { MemberRepository } from '../members/repository';
import type { InquiryListOptions } from './repository';

/** An inquiry after a change, and who had it before, so a caller can tell if the assignee moved. */
export type InquiryChange = { inquiry: Inquiry; previousAssignee: string | null };

export class InquiryService {
  private readonly db: SupabaseClient;
  private readonly repo: InquiryRepository;

  constructor(db: SupabaseClient) {
    this.db = db;
    this.repo = new InquiryRepository(db);
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
  ): Promise<InquiryChange> {
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');

    return this.applyUpdate(current, agencyId, input);
  }

  /** Applies a person's edit. A stored phone the edit leaves unchanged isn't validated or rewritten. */
  async edit(id: string, agencyId: string, input: unknown): Promise<InquiryChange> {
    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');

    const { caller_phone: callerPhone, ...rest } = editInquirySchemaFor(current.caller_phone).parse(input);
    return this.applyUpdate(current, agencyId, {
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
   * All of it happens in the `convert_inquiry` RPC, or none of it does (AD-050).
   */
  async convert(
    id: string,
    agencyId: string,
    input: ConvertInquirySchema
  ): Promise<{
    inquiryId: string;
    opportunityId: string;
    contactId: string | null;
    ownerId: string | null;
    previousAssignee: string | null;
    callerName: string | null;
  }> {
    const parsed = convertInquirySchema.parse(input);

    const current = await this.repo.findById(id, agencyId);
    if (!current) throw new DomainError('errors.not_found');
    this.assertValidTransition(current.status, 'converted');
    await this.assertAssignable(agencyId, parsed.assigned_to, current.assigned_to);

    // A new contact takes its name from the form, then from the caller, and its methods from the caller
    const newContact = parsed.create_contact && {
      type: parsed.create_contact.type,
      first_name: parsed.create_contact.first_name ?? current.caller_name?.split(' ')[0] ?? null,
      last_name: parsed.create_contact.last_name ?? (current.caller_name?.split(' ').slice(1).join(' ') || null),
      company_name: parsed.create_contact.company_name ?? null,
      display_name: generateDisplayName(parsed.create_contact.type, {
        first_name: parsed.create_contact.first_name ?? current.caller_name?.split(' ')[0],
        last_name: parsed.create_contact.last_name ?? current.caller_name?.split(' ').slice(1).join(' '),
        company_name: parsed.create_contact.company_name,
      }),
    };

    const ownerId = parsed.assigned_to ?? current.assigned_to ?? null;

    const { data, error } = await this.db.rpc('convert_inquiry', {
      p_agency_id: agencyId,
      p_inquiry_id: id,
      p_title: parsed.opportunity_title,
      p_type: parsed.opportunity_type,
      p_stage_id: parsed.stage_id,
      p_assigned_to: ownerId,
      p_contact_id: parsed.contact_id ?? null,
      p_new_contact: newContact ?? null,
      p_contact_methods: newContact ? callerContactMethods(current) : [],
    });
    if (error) throw rpcFailure(error);

    const { opportunity_id: opportunityId, contact_id: contactId } = data as {
      opportunity_id: string;
      contact_id: string | null;
    };
    return {
      inquiryId: id,
      opportunityId,
      contactId,
      ownerId,
      previousAssignee: current.assigned_to,
      callerName: current.caller_name,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async applyUpdate(current: Inquiry, agencyId: string, input: UpdateInquiryInput): Promise<InquiryChange> {
    const parsed = updateInquirySchema.parse(input);

    // Converted and dismissed inquiries are closed: nothing on them changes from here (I3).
    if (INQUIRY_STATUS_TRANSITIONS[current.status].length === 0) {
      throw new DomainError('errors.inquiries.final_state');
    }

    // Enforce status transition rules if status is being changed
    if (parsed.status) this.assertValidTransition(current.status, parsed.status);

    await this.assertAssignable(agencyId, parsed.assigned_to, current.assigned_to);

    const inquiry = await this.repo.update(current.id, agencyId, parsed as UpdateInquiryInput);
    return { inquiry, previousAssignee: current.assigned_to };
  }

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
