import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json';
import { QueueBar, QueueStepLink } from './queue-bar';

// Renders the props `<Link>` got, so the test sees `prefetch` (the real one drops it from the DOM).
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | null; children: ReactNode }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const KEY: [number, string] = [1730000000, '11111111-1111-4111-8111-111111111111'];

function links(html: string): { href: string; prefetch: string }[] {
  return [...html.matchAll(/<a href="([^"]+)" data-prefetch="([^"]+)"/g)].map(([, href, prefetch]) => ({
    href: href.replaceAll('&amp;', '&'),
    prefetch,
  }));
}

describe('QueueBar (rule 7)', () => {
  it('never prefetches a step: each one re-runs the list at the click', () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Sofia">
        <QueueBar listId="no-next-action" listName="No next action" pos={2} total={5} sortKey={KEY} scope="agency" />
      </NextIntlClientProvider>,
    );
    const steps = links(html).filter((l) => l.href.includes('/step?'));

    expect(steps.map((l) => l.href)).toEqual([
      '/lists/no-next-action/step?dir=prev&pos=2&scope=agency',
      `/lists/no-next-action/step?dir=next&pos=2&key=${KEY[0]}&after=${KEY[1]}&scope=agency`,
      `/lists/no-next-action/step?dir=next&pos=2&key=${KEY[0]}&after=${KEY[1]}&scope=agency`,
    ]);
    expect(steps.every((l) => l.prefetch === 'false')).toBe(true);
  });

  it('gives the list page\'s Work through link the same no-prefetch link', () => {
    const html = renderToString(<QueueStepLink href="/lists/stale-deals/step?dir=next&pos=0">{en.smartLists.queue.workThrough}</QueueStepLink>);

    expect(links(html)).toEqual([{ href: '/lists/stale-deals/step?dir=next&pos=0', prefetch: 'false' }]);
  });
});
