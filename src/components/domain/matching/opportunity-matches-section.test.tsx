import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import type { MatchPage, OpportunityMatch } from '@/domain/matching/types';
import { OpportunityMatchesSection } from './opportunity-matches-section';
import { PROPERTY_MATCH_KEYS } from './match-params';

const MESSAGES = { bg, en };

const buyer: OpportunityMatch = {
  opportunity_id: 'opp-buyer',
  opportunity_title: 'Ivan buys',
  opportunity_type: 'buyer',
  opportunity_status: 'active',
  primary_contact_id: 'c-1',
  assigned_to: 'u-1',
  listing_id: 'l-1',
  offer_type: 'sale',
  price: 185_000,
  listing_status: 'active',
  score: 100,
  criteria: [{ criterion: 'budget', result: 'match', must: true }],
  link_status: null,
  contact_name: 'Ivan Ivanov',
  broker_name: 'Charlie',
};
const tenant: OpportunityMatch = {
  ...buyer,
  opportunity_id: 'opp-tenant',
  opportunity_title: 'Petar rents',
  opportunity_type: 'tenant',
  opportunity_status: 'nurture',
  offer_type: 'rent',
  price: 750,
  link_status: 'viewed',
};

const page = (rows: OpportunityMatch[]): MatchPage<OpportunityMatch> => ({
  rows,
  total: rows.length,
  unlinked: rows.filter((row) => row.link_status === null).length,
  page: 1,
  pageSize: 10,
});

function render(locale: 'bg' | 'en', offerTypes: ('sale' | 'rent')[], rows: OpportunityMatch[]) {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Sofia">
      <OpportunityMatchesSection
        propertyId="p-1"
        offerTypes={offerTypes}
        matches={page(rows)}
        view={{ all: false, page: 1, linked: false }}
        baseParams={{}}
      />
    </NextIntlClientProvider>,
  );
}

describe('OpportunityMatchesSection', () => {
  it('is titled for buyers on a sale listing and for tenants on a rent listing', () => {
    expect(render('en', ['sale'], [buyer])).toContain(en.matching.dealsTitleSale);
    expect(render('en', ['rent'], [tenant])).toContain(en.matching.dealsTitleRent);
    expect(render('bg', ['sale'], [buyer])).toContain(bg.matching.dealsTitleSale);
  });

  it('shows buyers and tenants together, each with its type, when listed for both', () => {
    const html = render('en', ['sale', 'rent'], [buyer, tenant]);
    expect(html).toContain(en.matching.dealsTitleBoth);
    expect(html).toContain(en.Enums.opportunityType.buyer);
    expect(html).toContain(en.Enums.opportunityType.tenant);
  });

  it('shows no type label when the list is one kind', () => {
    expect(render('en', ['sale'], [buyer])).not.toContain(`>${en.Enums.opportunityType.buyer}<`);
  });

  it('marks a nurture deal, shows the link status instead of the add button, and offers add on a new match', () => {
    const html = render('en', ['sale', 'rent'], [buyer, tenant]);
    expect(html).toContain(en.Enums.opportunityStatus.nurture);
    expect(html).toContain(en.Enums.propertyLinkStatus.viewed);
    expect(html.match(/Add to this deal/g)).toHaveLength(1);
    expect(html).toContain('Charlie');
    expect(html).toContain('Ivan Ivanov');
  });

  it('says so when no deal fits, and links the toggle with the property list keys', () => {
    const html = render('en', ['sale'], []);
    expect(html).toContain(en.matching.dealsEmpty);
    expect(html).toContain(`${PROPERTY_MATCH_KEYS.linked}=1`);
  });
});
