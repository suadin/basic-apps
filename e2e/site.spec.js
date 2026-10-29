import { expect, test } from './fixtures.js';

const METRICS = {
  unit: {
    tests: 6,
    failures: 0,
    coverage: 77.63,
    measuredAt: '2026-10-27T18:15',
    durationSeconds: 0.1,
    perTest: 0.0167,
  },
  e2e: {
    tests: 7,
    failures: 0,
    coverage: 81.25,
    measuredAt: '2026-10-27T18:16',
    durationSeconds: 4.2,
    perTest: 0.6,
  },
};

const STATE = {
  generatedAt: '2026-10-29T11:45',
  workspace: '~/dev',
  folders: [
    {
      name: 'repos',
      role: 'projects with their own history',
      text: 'Cloned by restore.sh, not part of the workspace repository.',
      public: true,
      entries: ['alpha', 'beta'],
      count: 2,
    },
    {
      name: 'secrets',
      role: 'one file per token',
      text: 'Closed to the agent by configuration.',
      public: false,
      entries: null,
      count: null,
    },
  ],
  files: [{ name: 'AGENTS.md', text: 'The rules of this workspace.' }],
  repos: [
    {
      name: 'alpha',
      description: 'The first project.',
      remote: true,
      appVersion: '1.0.0',
      standard: '1.1.1',
      profiles: ['web-static'],
      deviations: 0,
      lastCommit: '2026-10-28',
      localOnly: false,
      restored: true,
    },
    {
      name: 'zeta',
      description: 'Only on this machine.',
      remote: false,
      appVersion: null,
      standard: null,
      profiles: [],
      deviations: 0,
      lastCommit: null,
      localOnly: true,
      restored: false,
    },
  ],
  drift: [],
  sensitive: 'clean',
};

async function open(page, latest = '1.1.1') {
  await page.route('**/test-metrics.json', (route) => route.fulfill({ json: METRICS }));
  await page.route('**/state.json', (route) => route.fulfill({ json: STATE }));
  if (latest === null) {
    await page.route('**/version.json', (route) => route.abort());
  } else {
    await page.route('**/version.json', (route) =>
      route.fulfill({ json: { version: latest, releasedAt: '2026-10-27', url: '#' }, headers: { 'access-control-allow-origin': '*' } }),
    );
  }
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('basic-apps');
  await expect(page.locator('#app-version')).toHaveText('0.1.0');
}

test('[BASIC-FOOTER-01] footer shows six icons', async ({ page }) => {
  await open(page);
  await expect(page.locator('.footer-items .footer-item')).toHaveCount(6);
  const icons = await page.locator('.footer-items svg, .footer-items img').evaluateAll((nodes) =>
    nodes.map((node) => node.outerHTML),
  );
  expect(icons).toHaveLength(6);
  expect(new Set(icons).size).toBe(icons.length);
});

test('[BASIC-FOOTER-02] footer shows counts and coverage', async ({ page }) => {
  await open(page);
  await expect(page.locator('#unit-label')).toHaveText('Unit 6 · 77.63 %');
  await expect(page.locator('#e2e-label')).toHaveText('E2E 7 · 81.25 %');
});

test('[BASIC-FOOTER-03] tooltip has three rows', async ({ page }) => {
  await open(page);
  await page.locator('#unit-metrics').hover();
  await expect(page.locator('#tooltip')).toContainText('Measured 2026-10-27T18:15');
  await expect(page.locator('#tooltip')).toContainText('Duration 0.1 s');
  await expect(page.locator('#tooltip')).toContainText('Per test 0.0167 s');
});

test('[BASIC-READER-01] README opens the reader', async ({ page }) => {
  await open(page);
  await page.locator('#readme').click();
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('.reader-tab')).toHaveCount(3);
  await expect(page.locator('.reader-section').first()).toBeVisible();
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('[BASIC-LINKS-01] a reload restores the reader section', async ({ page }) => {
  await open(page);
  await page.goto('/#/docs/readme/tests');
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#reader-section-title')).toHaveText('Tests');
  await page.reload();
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#reader-section-title')).toHaveText('Tests');
});

test('[BASIC-LINKS-01] the publishable mode lives in the address', async ({ page }) => {
  await open(page);
  await expect(page.locator('#folder-cards .card')).toHaveCount(2);
  await page.locator('#mode-b').click();
  await expect(page).toHaveURL(/#\/mode\/b$/);
  await expect(page.locator('#folder-cards .card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#folder-cards .card')).toHaveCount(1);
  await expect(page.locator('#folder-cards .card')).toHaveAttribute('data-public', 'yes');
});

test('[BASIC-DATA-01] a closed folder shows its existence and no names', async ({ page }) => {
  await open(page);
  const closed = page.locator('.card', { hasText: 'secrets/' });
  await expect(closed).toContainText('existence only');
  await expect(closed).not.toContainText('one.token');
});

test('[BASIC-DATES-01] dates use yyyy-mm-dd hh:mm', async ({ page }) => {
  await open(page);
  await expect(page.locator('time')).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  await expect(page.locator('#generated-at')).toHaveText('2026-10-29 11:45');
});

test('[BASIC-DESIGN-01] the page follows the OS colour scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  const background = await page.locator('body').evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(background).toBe('rgb(32, 31, 37)');
});

test('[BASIC-LAYOUT-01] header and footer stay visible', async ({ page }) => {
  await open(page);
  await page.locator('#readme').click();
  await page.locator('#reader-body').evaluate((node) => {
    node.style.minHeight = '200vh';
  });
  await page.locator('#reader-body').evaluate((node) => node.scrollIntoView());
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('[BASIC-FOOTER-04] the footer is fixed and wraps cleanly', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 360, height: 720 });
  const footer = page.locator('footer');
  await expect(footer).toBeVisible();
  expect(await footer.evaluate((node) => getComputedStyle(node).position)).toBe('fixed');
  await expect(page.locator('.footer-items .footer-item')).toHaveCount(6);
});

test('[BASIC-LAYOUT-02] the header is one row', async ({ page }) => {
  await open(page);
  const title = await page.locator('h1').boundingBox();
  const actions = await page.locator('.actions').boundingBox();
  expect(Math.abs(title.y + title.height / 2 - (actions.y + actions.height / 2))).toBeLessThan(8);
});

test('[BASIC-DESIGN-02] focus uses the green outline', async ({ page }) => {
  await open(page);
  await page.locator('#theme').focus();
  const outline = await page.locator('#theme').evaluate((node) => getComputedStyle(node).outlineColor);
  expect(outline).toBe('rgb(88, 139, 85)');
});

test('[BASIC-DESIGN-04] the root stays at 100%', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('16px');
  await page.setViewportSize({ width: 800, height: 700 });
  await expect(page.locator('main')).toBeVisible();
});

test('[BASIC-READER-05] SPECS starts with Changelog', async ({ page }) => {
  await open(page);
  await page.locator('#specs').click();
  await expect(page).toHaveURL(/#\/docs\/app-specs$/);
  await expect(page.locator('.reader-tab')).toHaveText(['README', 'SPECS', 'BASIC SPECS']);
  await expect(page.locator('#reader-section-title')).toHaveText('Changelog');
  await expect(page.locator('.reader-section').first()).toHaveAttribute('data-tip', 'Changelog');
  await expect(page.locator('#reader-body')).toContainText('0.1.0');
});

test('[BASIC-VERSION-01] the app version opens SPECS and stays neutral', async ({ page }) => {
  await open(page, '2.0.0');
  await expect(page.locator('#specs')).not.toHaveClass(/outdated/);
  await expect(page.locator('#specs')).toHaveAttribute('data-tip', 'basic-apps 0.1.0 — open SPECS');
  await page.locator('#specs').click();
  await expect(page).toHaveURL(/#\/docs\/app-specs$/);
});

test('[BASIC-VERSION-02] the Basic Specs version opens BASIC SPECS', async ({ page }) => {
  await open(page);
  await expect(page.locator('#basic-version')).toHaveText('1.1.1');
  await page.locator('#basic-specs').click();
  await expect(page).toHaveURL(/#\/docs\/basic-specs$/);
  await expect(page.locator('#reader-title')).toHaveText('BASIC SPECS');
});

test('[BASIC-VERSION-03] only a major update turns red', async ({ page }) => {
  await open(page, '1.2.0');
  await expect(page.locator('#basic-specs')).not.toHaveClass(/outdated/);
  await expect(page.locator('#basic-specs')).toHaveAttribute('data-tip', /1\.2\.0 available/);
  await open(page, '2.0.0');
  await expect(page.locator('#basic-specs')).toHaveClass(/outdated/);
  await expect(page.locator('#basic-specs')).toHaveAttribute('data-tip', /2\.0\.0 available/);
});

test('[BASIC-VERSION-04] an unavailable latest version stays neutral', async ({ page }) => {
  await open(page, null);
  await expect(page.locator('#basic-specs')).not.toHaveClass(/outdated/);
  await expect(page.locator('#basic-specs')).toHaveAttribute('data-tip', /latest not checked/);
});
