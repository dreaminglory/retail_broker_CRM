import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, findNavItem, isNavItemActive, visibleNavGroups } from './nav-config';

const DASHBOARD = join(process.cwd(), 'src', 'app', '(dashboard)');

/** Top-level dashboard routes that render a page (`/today`, `/contacts`, ...). */
function dashboardRoutes(): string[] {
  return readdirSync(DASHBOARD, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(DASHBOARD, entry.name, 'page.tsx')))
    .map((entry) => `/${entry.name}`)
    .sort();
}

describe('sidebar groups (ui-bright)', () => {
  it('lists every dashboard route exactly once', () => {
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect([...hrefs].sort()).toEqual(dashboardRoutes());
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('groups the routes as the Bright screens do', () => {
    expect(NAV_GROUPS.map((g) => [g.key, g.items.map((i) => i.key)])).toEqual([
      ['myDay', ['today', 'inquiries']],
      ['work', ['opportunities', 'lists']],
      ['base', ['contacts', 'properties']],
      ['agency', ['dashboard', 'reports', 'exceptions', 'settings']],
    ]);
  });

  it('keeps Exceptions for owners and managers only', () => {
    const keys = (role: string) =>
      visibleNavGroups(role).flatMap((g) => g.items.map((i) => i.key));
    expect(keys('broker')).not.toContain('exceptions');
    expect(keys('manager')).toContain('exceptions');
    expect(keys('owner')).toContain('exceptions');
    expect(keys('broker')).toHaveLength(9);
  });

  it('marks Отчети as a Скоро placeholder, and nothing else', () => {
    const soon = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.comingSoon).map((i) => i.key);
    expect(soon).toEqual(['reports']);
  });

  it('drops a group whose items are all hidden', () => {
    expect(visibleNavGroups('broker').every((g) => g.items.length > 0)).toBe(true);
  });

  it('marks the item for a nested path active, and Табло only on its own path', () => {
    expect(isNavItemActive('/opportunities', '/opportunities/abc')).toBe(true);
    expect(isNavItemActive('/lists', '/listsx')).toBe(false);
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
    expect(isNavItemActive('/settings', '/settings/team')).toBe(true);
  });

  it('finds the group and item for a path (breadcrumb)', () => {
    expect(findNavItem('/opportunities/123')).toMatchObject({
      group: { key: 'work' },
      item: { key: 'opportunities' },
    });
    expect(findNavItem('/today')).toMatchObject({ group: { key: 'myDay' }, item: { key: 'today' } });
    expect(findNavItem('/nowhere')).toBeNull();
  });
});
