import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import type { Opportunity } from '@/domain/opportunities/types';
import type { Requirement } from '@/domain/requirements/types';
import { LinkedOpportunities } from './linked-opportunities';

const MESSAGES = { bg, en };

const deal = (id: string, title: string, type: Opportunity['type']) =>
  ({
    id,
    agency_id: 'agency-1',
    title,
    type,
    stage_id: 'stage-1',
    status: 'active',
    temperature: 'warm',
    expected_value: null,
    currency: 'EUR',
    next_action_at: null,
  }) as Opportunity;

const requirement = {
  opportunity_id: 'buyer-deal',
  budget_min: null,
  budget_max: 200_000,
  property_types: ['apartment'],
  rooms_min: null,
  rooms_max: null,
  area_m2_min: null,
  area_m2_max: null,
  budget_must: true,
  type_must: true,
  location_must: true,
  rooms_must: false,
  area_m2_must: false,
  locations: [{ settlement_id: 's', settlement_name: 'София', area_id: 'a1', area_name: 'Лозенец', area_active: true }],
} as unknown as Requirement;

function render(locale: 'bg' | 'en') {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Sofia">
      <LinkedOpportunities
        opportunities={[deal('buyer-deal', 'Buyer deal', 'buyer'), deal('seller-deal', 'Seller deal', 'seller')]}
        requirements={{ 'buyer-deal': requirement }}
        stages={[]}
      />
    </NextIntlClientProvider>,
  )
    .replace(/<!-- -->/g, '')
    .replace(/[  ]/g, ' ');
}

describe('LinkedOpportunities', () => {
  it.each([
    ['bg', 'Апартамент, Лозенец, до 200 000 €'],
    ['en', 'Apartment, Лозенец, up to €200,000'],
  ] as const)("shows a buyer deal's requirement summary in %s (FR-REQ-05)", (locale, summary) => {
    const html = render(locale);

    expect(html.match(new RegExp(summary, 'g'))).toHaveLength(2); // the text and its title
    expect(html.split('Seller deal')[1]).not.toContain(summary);
  });
});
