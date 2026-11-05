import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import type { OpportunityType } from '@/domain/opportunities/types';
import type { Requirement } from '@/domain/requirements/types';
import { RequirementSection } from './requirement-section';

const MESSAGES = { bg, en };

const seeded: Requirement = {
  id: 'r-1',
  agency_id: 'agency-1',
  opportunity_id: 'opp-1',
  budget_min: 150_000,
  budget_max: 200_000,
  property_types: ['apartment', 'maisonette'],
  rooms_min: 2,
  rooms_max: 3,
  area_m2_min: null,
  area_m2_max: null,
  floor_min: null,
  floor_max: null,
  not_top_floor: true,
  construction: ['brick'],
  financing: 'mortgage',
  wishes: 'Паркомясто',
  budget_must: true,
  location_must: true,
  type_must: true,
  rooms_must: false,
  area_m2_must: false,
  floor_must: false,
  construction_must: false,
  location_keys: ['s:a1', 's:a2'],
  created_by: null,
  created_at: '2026-11-05T09:00:00Z',
  updated_at: '2026-11-05T09:00:00Z',
  locations: [
    { settlement_id: 's', settlement_name: 'София', area_id: 'a1', area_name: 'Лозенец', area_active: true },
    { settlement_id: 's', settlement_name: 'София', area_id: 'a2', area_name: 'Изток', area_active: false },
  ],
};

function render(locale: "bg" | "en", requirement: Requirement | null, type: OpportunityType = "buyer", editable = true) {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Sofia">
      <RequirementSection opportunityId="opp-1" requirement={requirement} opportunityType={type} editable={editable} />
    </NextIntlClientProvider>,
  )
    .replace(/<!-- -->/g, '')
    .replace(/[  ]/g, ' ');
}

describe('RequirementSection', () => {
  it.each([
    ['bg', null, 'Добави'],
    ['bg', seeded, 'Редактирай'],
    ['en', null, 'Add'],
    ['en', seeded, 'Edit'],
  ] as const)('offers %s %s as %s on an editable deal', (locale, requirement, button) => {
    expect(render(locale, requirement)).toContain(`${button}</button>`);
  });

  it('offers no button on a closed deal (rule 7)', () => {
    expect(render('en', seeded, 'buyer', false)).not.toContain('</button>');
    expect(render('en', null, 'buyer', false)).not.toContain('</button>');
  });

  it.each([
    ['bg', 'Изисквания', 'Добавете какво търси клиентът.'],
    ['en', 'Requirements', 'Add the client&#x27;s search.'],
  ] as const)('shows the empty state (%s)', (locale, title, empty) => {
    const html = render(locale, null);

    expect(html).toContain(title);
    expect(html).toContain(empty);
  });

  it('shows the summary, the criteria and the inactive area (BG)', () => {
    const html = render('bg', seeded);

    expect(html).toContain('Апартамент или мезонет');
    expect(html).toContain('150 000 €–200 000 €');
    expect(html).toContain('Бюджет (цена)');
    expect(html).toContain('Лозенец (София)');
    expect(html).toContain('неактивен');
    expect(html).toContain('не последен');
    expect(html).toContain('Тухла');
    expect(html).toContain('Ипотечен кредит');
    expect(html).toContain('Паркомясто');
    expect(html).toContain('Обновени на');
    expect(html.match(/задължително/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('shows the criteria in English', () => {
    const html = render('en', seeded);

    expect(html).toContain('Apartment or maisonette');
    expect(html).toContain('€150,000–€200,000');
    expect(html).toContain('Budget (price)');
    expect(html).toContain('Mortgage');
    expect(html).toContain('Updated on');
  });

  it.each([
    ['bg', 'Бюджет (наем на месец)', '150 000 €–200 000 € / месец'],
    ['en', 'Budget (monthly rent)', '€150,000–€200,000 / month'],
  ] as const)('labels the budget as rent on a tenant deal (%s)', (locale, label, budget) => {
    const html = render(locale, seeded, 'tenant');

    expect(html).toContain(label);
    expect(html).toContain(budget);
  });
});
