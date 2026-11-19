import { describe, expect, it } from 'vitest';
import { contactCallTarget, opportunityCallTarget } from './call-targets';

const STAGES = [{ id: 's1', name: 'New' }];
const deal = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Deal ${id}`,
  stage_id: 's1',
  status,
  ...extra,
});

describe('opportunityCallTarget (spec phone-loop rule 2: the deal and the tapped contact)', () => {
  it('logs on the deal and the contact, with its stages and pending count', () => {
    expect(opportunityCallTarget(deal('d1', 'active'), { id: 'c1', display_name: 'Ivan' }, 2, STAGES)).toEqual({
      context: { opportunity_id: 'd1', contact_id: 'c1' },
      name: 'Ivan',
      deal: { id: 'd1', title: 'Deal d1', stageId: 's1', active: true, pendingTaskCount: 2 },
      stages: STAGES,
    });
  });

  it('names the deal when it has no contact, and marks a closed deal inactive (rule 8)', () => {
    const target = opportunityCallTarget(deal('d1', 'won'), null, 0, STAGES);
    expect(target.context).toEqual({ opportunity_id: 'd1', contact_id: null });
    expect(target.name).toBe('Deal d1');
    expect(target.deal?.active).toBe(false);
  });
});

describe('contactCallTarget (rule 2: the contact, plus its one active deal)', () => {
  const contact = { id: 'c1', display_name: 'Ivan' };

  it('logs on the contact alone without an active deal', () => {
    expect(contactCallTarget(contact, [deal('d1', 'won')], {}, STAGES)).toEqual({ context: { contact_id: 'c1' }, name: 'Ivan', stages: STAGES });
  });

  it('takes the one active deal automatically', () => {
    const target = contactCallTarget(contact, [deal('d1', 'active'), deal('d2', 'lost')], { d1: 1 }, STAGES);
    expect(target.context).toEqual({ contact_id: 'c1', opportunity_id: 'd1' });
    expect(target.deal).toEqual({ id: 'd1', title: 'Deal d1', stageId: 's1', active: true, pendingTaskCount: 1 });
    expect(target.dealChoices).toBeUndefined();
  });

  it('asks which deal when there are several active ones', () => {
    const target = contactCallTarget(contact, [deal('d1', 'active'), deal('d2', 'active')], { d2: 3 }, STAGES);
    expect(target.context).toEqual({ contact_id: 'c1' });
    expect(target.deal).toBeUndefined();
    expect(target.dealChoices?.map((d) => [d.id, d.pendingTaskCount])).toEqual([
      ['d1', 0],
      ['d2', 3],
    ]);
  });
});
