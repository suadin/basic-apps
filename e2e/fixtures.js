import { test as base } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    try {
      await use(page);
    } finally {
      try {
        const entries = await page.coverage.stopJSCoverage();
        if (entries.length) {
          const dir = testInfo.outputPath();
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, 'coverage.json'), JSON.stringify(entries));
        }
      } catch {
        // The page may already be closed; the other journeys still count.
      }
    }
  },
});

export { expect } from '@playwright/test';
