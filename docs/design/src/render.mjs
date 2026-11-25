import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as A from './screens-a.mjs';
import * as B from './screens-b.mjs';

import { fileURLToPath } from 'node:url';

// Renders the screens built from code (not the claude.ai canvas) to docs/design/screens.
// Run from anywhere: node docs/design/src/render.mjs [screen-name ...]
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(PROJECT + '/package.json');
const { chromium } = require('playwright');

const OUT = path.join(PROJECT, 'docs/design/screens');
const HTML = path.join(os.tmpdir(), 'brokercrm-design-html');
mkdirSync(OUT, { recursive: true });
mkdirSync(HTML, { recursive: true });

const screens = {
  'contact-detail': A.contactDetail,
  'deals': A.deals,
  'property-detail': A.propertyDetail,
  'property-form': A.propertyForm,
  'lists': B.lists,
  'list-detail': B.listDetail,
  'settings-team': B.settingsTeam,
  'settings-stages': B.settingsStages,
  'settings-lead-sources': B.settingsLeadSources,
  'settings-areas': B.settingsAreas,
  'settings-import': B.settingsImport,
  'settings-import-new': B.settingsImportNew,
  'settings-profile': B.settingsProfile,
  'login': B.login,
};
const only = process.argv.slice(2);

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
for (const [name, fn] of Object.entries(screens)) {
  if (only.length && !only.includes(name)) continue;
  const file = path.join(HTML, name + '.html');
  writeFileSync(file, fn());
  await pg.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  console.log('ok', name);
}
await browser.close();
