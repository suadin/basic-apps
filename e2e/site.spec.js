import { expect, test } from './fixtures.js';

// basic-apps journeys: only what belongs to this app. The footer, reader,
// layout, design and version states are the package's own suite.

const METRICS = {
  unit: { tests: 6, failures: 0, coverage: 77.63, measuredAt: '2026-10-27T18:15', durationSeconds: 0.1, perTest: 0.0167 },
  e2e: { tests: 7, failures: 0, coverage: 81.25, measuredAt: '2026-10-27T18:16', durationSeconds: 4.2, perTest: 0.6 },
};

const STATE = {
  generatedAt: '2026-10-29T11:45',
  workspace: '~/dev',
  folders: [
    { name: 'repos', role: 'projects with their own history', text: 'Cloned by restore.sh, not part of the workspace repository.', public: true, entries: ['alpha', 'beta'], count: 2 },
    { name: 'secrets', role: 'one file per token', text: 'Closed to the agent by configuration.', public: false, entries: null, count: null },
  ],
  files: [{ name: 'AGENTS.md', text: 'The rules of this workspace.' }],
  repos: [
    { name: 'alpha', description: 'The first project.', remote: true, appVersion: '1.0.0', standard: '1.1.1', profiles: ['web-static'], deviations: 0, lastCommit: '2026-10-28', localOnly: false, restored: true },
    { name: 'zeta', description: 'Only on this machine.', remote: false, appVersion: null, standard: null, profiles: [], deviations: 0, lastCommit: null, localOnly: true, restored: false },
  ],
  drift: [],
  sensitive: 'clean',
};

async function open(page) {
  await page.route('**/test-metrics.json', (route) => route.fulfill({ json: METRICS }));
  await page.route('**/state.json', (route) => route.fulfill({ json: STATE }));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('basic-apps');
  await expect(page.locator('#app-version')).toHaveText('0.1.0');
}

test('[NORM-LINKS-01] the publishable mode lives in the address', async ({ page }) => {
  await open(page);
  await expect(page.locator('#folder-cards .card')).toHaveCount(2);
  await page.locator('#mode-b').click();
  await expect(page).toHaveURL(/#\/mode\/b$/);
  await expect(page.locator('#folder-cards .card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#folder-cards .card')).toHaveCount(1);
  await expect(page.locator('#folder-cards .card')).toHaveAttribute('data-public', 'yes');
});

test('[NORM-DATA-01] a closed folder shows its existence and no names', async ({ page }) => {
  await open(page);
  const closed = page.locator('.card', { hasText: 'secrets/' });
  await expect(closed).toContainText('existence only');
  await expect(closed).not.toContainText('one.token');
});

test('[NORM-DATES-01] dates use yyyy-mm-dd hh:mm', async ({ page }) => {
  await open(page);
  await expect(page.locator('time')).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  await expect(page.locator('#generated-at')).toHaveText('2026-10-29 11:45');
});
