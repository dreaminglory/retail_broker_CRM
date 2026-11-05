import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import type { Opportunity } from '@/domain/opportunities/types';
import { LinkedOpportunities } from './linked-opportunities';

const deal = (id: string, title: string, type: Opportunity['type']): Opportunity => ({
  id,
  agency_id: 'agency-1',
  title,
  type,
  stage_id: 'stage-1',
  primary_contact_id: null,
  source_id: null,
  inquiry_id: null,
  assigned_to: null,
  status: 'active',
  temperature: 'warm',
  expected_value: null,
  currency: 'EUR',
  notes: null,
  next_action_at: null,
  closed_at: null,
  lost_reason: null,
  created_by: null,
  created_at: '2026-11-05T09:00:00Z',
  updated_at: '2026-11-05T09:00:00Z',
});

describe('LinkedOpportunities', () => {
  it("shows a deal's requirement summary under its title only (FR-REQ-05)", () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Sofia">
        <LinkedOpportunities
          opportunities={[deal('buyer-deal', 'Buyer deal', 'buyer'), deal('seller-deal', 'Seller deal', 'seller')]}
          requirementSummaries={{ 'buyer-deal': 'Apartment, Лозенец, up to €200,000' }}
          stages={[]}
        />
      </NextIntlClientProvider>,
    );
    const [buyerRow, sellerRow] = html.split('Seller deal');

    expect(buyerRow).toContain('Apartment, Лозенец, up to €200,000');
    expect(sellerRow).not.toContain('Requirements');
  });
});
