import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import type { OpportunityType } from '@/domain/opportunities/types';
import type { Requirement } from '@/domain/requirements/types';
import { RequirementSummaryLine } from './requirement-summary-line';

const MESSAGES = { bg, en };

const requirement: Requirement = {
  id: 'r-1',
  agency_id: 'agency-1',
  opportunity_id: 'opp-1',
  budget_min: null,
  budget_max: 200_000,
  property_types: ['apartment'],
  rooms_min: 2,
  rooms_max: null,
  area_m2_min: null,
  area_m2_max: null,
  floor_min: null,
  floor_max: null,
  not_top_floor: false,
  construction: [],
  financing: 'unknown',
  wishes: null,
  budget_must: true,
  location_must: true,
  type_must: true,
  rooms_must: false,
  area_m2_must: false,
  floor_must: false,
  construction_must: false,
  location_keys: ['s:a1'],
  created_by: null,
  created_at: '2026-11-05T09:00:00Z',
  updated_at: '2026-11-05T09:00:00Z',
  locations: [{ settlement_id: 's', settlement_name: 'София', area_id: 'a1', area_name: 'Лозенец', area_active: true }],
};

function render(locale: 'bg' | 'en', value: Requirement | undefined, type: OpportunityType = 'buyer') {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Sofia">
      <RequirementSummaryLine requirement={value} opportunityType={type} />
    </NextIntlClientProvider>,
  )
    .replace(/<!-- -->/g, '')
    .replace(/[  ]/g, ' ');
}

describe('RequirementSummaryLine', () => {
  it.each([
    ['bg', 'Апартамент, от 2 стаи, Лозенец, до 200 000 €'],
    ['en', 'Apartment, from 2 rooms, Лозенец, up to €200,000'],
  ] as const)('shows the summary in %s', (locale, expected) => {
    expect(render(locale, requirement)).toContain(expected);
  });

  it('reads the budget as rent on a tenant deal', () => {
    expect(render('en', requirement, 'tenant')).toContain('up to €200,000 / month');
  });

  it('renders nothing without a requirement', () => {
    expect(render('bg', undefined)).toBe('');
  });
});
