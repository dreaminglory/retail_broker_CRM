import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

const inquiries = {
  getById: vi.fn(),
  update: vi.fn(),
  edit: vi.fn(),
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
  },
}));
vi.mock('@/domain/notifications/notify-after', () => ({
  notifyAfterResponse: (work: (service: unknown) => Promise<void>) => {
    scheduled.push(() => work({ notifyInquiryAssigned }));
  },
}));

const { reassignInquiryAction, updateInquiryAction } = await import('./actions');

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
