import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

const inquiries = {
  getById: vi.fn(),
  update: vi.fn(),
  edit: vi.fn(),
  create: vi.fn(),
  convert: vi.fn(),
  findConversionDuplicates: vi.fn(),
};
const notifyInquiryAssigned = vi.fn();
let scheduled: Array<() => Promise<void>> = [];

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/domain/inquiries/service', () => ({
  InquiryService: class {
    getById = inquiries.getById;
    update = inquiries.update;
    edit = inquiries.edit;
    create = inquiries.create;
    convert = inquiries.convert;
    findConversionDuplicates = inquiries.findConversionDuplicates;
  },
}));
vi.mock('@/domain/notifications/notify-after', () => ({
  notifyAfterResponse: (work: (service: unknown) => Promise<void>) => {
    scheduled.push(() => work({ notifyInquiryAssigned }));
  },
}));

const { convertInquiryAction, createInquiryAction, reassignInquiryAction, updateInquiryAction } = await import('./actions');

const ME = 'user-me';
const COLLEAGUE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const inquiry = (assignedTo: string | null) => ({ id: 'inq-1', assigned_to: assignedTo, caller_name: 'Maria' });

function editForm(assignedTo: string | null): FormData {
  const form = new FormData();
  form.set('caller_name', 'Maria');
  if (assignedTo) form.set('assigned_to', assignedTo);
  return form;
}

async function runScheduled() {
  for (const work of scheduled) await work();
}

beforeEach(() => {
  fake = createFakeSupabase({ role: 'broker', userId: ME, agencyId: 'agency-1' });
  scheduled = [];
  notifyInquiryAssigned.mockReset();
  inquiries.getById.mockReset().mockResolvedValue(inquiry(OTHER));
  inquiries.update.mockReset();
  inquiries.edit.mockReset();
});

describe('reassignInquiryAction', () => {
  it('emails a colleague it assigns the inquiry to (AC-3)', async () => {
    inquiries.update.mockResolvedValue(inquiry(COLLEAGUE));

    const result = await reassignInquiryAction('inq-1', COLLEAGUE);
    await runScheduled();

    expect(result.success).toBe(true);
    expect(notifyInquiryAssigned).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      assigneeId: COLLEAGUE,
      inquiryId: 'inq-1',
      callerName: 'Maria',
    });
  });

  it('sends nothing when you assign the inquiry to yourself', async () => {
    inquiries.update.mockResolvedValue(inquiry(ME));

    await reassignInquiryAction('inq-1', COLLEAGUE);

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when the inquiry is unassigned', async () => {
    inquiries.update.mockResolvedValue(inquiry(null));

    await reassignInquiryAction('inq-1', null);

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when the assignee stays the same', async () => {
    inquiries.getById.mockResolvedValue(inquiry(COLLEAGUE));
    inquiries.update.mockResolvedValue(inquiry(COLLEAGUE));

    await reassignInquiryAction('inq-1', COLLEAGUE);

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when the reassign is refused', async () => {
    inquiries.update.mockRejectedValue(new Error('refused'));

    const result = await reassignInquiryAction('inq-1', COLLEAGUE);

    expect(result.success).toBe(false);
    expect(scheduled).toHaveLength(0);
  });
});

describe('updateInquiryAction', () => {
  it('emails a colleague when the edit changes the assignee', async () => {
    inquiries.edit.mockResolvedValue(inquiry(COLLEAGUE));

    const result = await updateInquiryAction('inq-1', { success: true, data: undefined }, editForm(COLLEAGUE));
    await runScheduled();

    expect(result.success).toBe(true);
    expect(notifyInquiryAssigned).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      assigneeId: COLLEAGUE,
      inquiryId: 'inq-1',
      callerName: 'Maria',
    });
  });

  it('sends nothing when the edit leaves the assignee alone', async () => {
    inquiries.edit.mockResolvedValue(inquiry(OTHER));

    await updateInquiryAction('inq-1', { success: true, data: undefined }, editForm(OTHER));

    expect(scheduled).toHaveLength(0);
  });
});

describe('createInquiryAction', () => {
  const createForm = (assignedTo: string | null) => {
    const form = new FormData();
    form.set('source_id', '33333333-3333-4333-8333-333333333333');
    form.set('caller_name', 'Maria');
    form.set('caller_phone', '+359888123456');
    if (assignedTo) form.set('assigned_to', assignedTo);
    return form;
  };

  it('emails a colleague it assigns the new inquiry to', async () => {
    inquiries.create.mockResolvedValue(inquiry(COLLEAGUE));

    const result = await createInquiryAction({ success: true, data: undefined }, createForm(COLLEAGUE));
    await runScheduled();

    expect(result.success).toBe(true);
    expect(notifyInquiryAssigned).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      assigneeId: COLLEAGUE,
      inquiryId: 'inq-1',
      callerName: 'Maria',
    });
  });

  it('sends nothing when you assign the new inquiry to yourself', async () => {
    inquiries.create.mockResolvedValue(inquiry(ME));

    await createInquiryAction({ success: true, data: undefined }, createForm(ME));

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when the new inquiry is assigned to no one', async () => {
    inquiries.create.mockResolvedValue(inquiry(null));

    await createInquiryAction({ success: true, data: undefined }, createForm(null));

    expect(scheduled).toHaveLength(0);
  });
});

describe('convertInquiryAction', () => {
  const convertForm = (assignedTo: string | null, extra: Record<string, string> = {}) => {
    const form = new FormData();
    form.set('contact_id', '44444444-4444-4444-8444-444444444444');
    form.set('opportunity_title', 'Apartment');
    form.set('opportunity_type', 'buyer');
    form.set('stage_id', '55555555-5555-4555-8555-555555555555');
    if (assignedTo) form.set('assigned_to', assignedTo);
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    return form;
  };
  const converted = { inquiryId: 'inq-1', opportunityId: 'opp-1', contactId: 'contact-1' };

  beforeEach(() => {
    inquiries.convert.mockReset().mockResolvedValue(converted);
    inquiries.findConversionDuplicates.mockReset().mockResolvedValue([]);
  });

  it('emails a colleague who becomes the owner, linking to the opportunity', async () => {
    const result = await convertInquiryAction('inq-1', { success: true, data: undefined }, convertForm(COLLEAGUE));
    await runScheduled();

    expect(result.success).toBe(true);
    expect(notifyInquiryAssigned).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      assigneeId: COLLEAGUE,
      inquiryId: 'inq-1',
      callerName: 'Maria',
      opportunityId: 'opp-1',
    });
  });

  it('sends nothing when the owner is the inquiry assignee', async () => {
    await convertInquiryAction('inq-1', { success: true, data: undefined }, convertForm(OTHER));

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when no owner is chosen, since the inquiry assignee keeps it', async () => {
    await convertInquiryAction('inq-1', { success: true, data: undefined }, convertForm(null));

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when you make yourself the owner', async () => {
    await convertInquiryAction('inq-1', { success: true, data: undefined }, convertForm(ME));

    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing on a duplicate warning', async () => {
    inquiries.findConversionDuplicates.mockResolvedValue([{ id: 'contact-2' }]);
    const form = convertForm(COLLEAGUE);
    form.delete('contact_id');
    form.set('create_contact', JSON.stringify({ type: 'person', first_name: 'Maria' }));

    const result = await convertInquiryAction('inq-1', { success: true, data: undefined }, form);

    expect(result).toEqual({ success: true, data: { duplicates: [{ id: 'contact-2' }] } });
    expect(inquiries.convert).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });

  it('sends nothing when the conversion fails', async () => {
    inquiries.convert.mockRejectedValue(new Error('refused'));

    const result = await convertInquiryAction('inq-1', { success: true, data: undefined }, convertForm(COLLEAGUE));

    expect(result.success).toBe(false);
    expect(scheduled).toHaveLength(0);
  });
});
