import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineCoverage } from './coverage.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function number(pattern, text) {
  const match = pattern.exec(text);
  return match ? Number(match[1]) : null;
}

const unit = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-reporter=tap',
    '--experimental-test-coverage',
    '--test-coverage-include=site/logic.js',
    '--test-coverage-include=site/reader.js',
    'test/reader.test.js',
    'test/version.test.js',
    'test/state.test.js',
  ],
  { cwd: root, encoding: 'utf8' },
);
process.stdout.write(unit.stdout ?? '');
process.stderr.write(unit.stderr ?? '');
const unitText = `${unit.stdout ?? ''}\n${unit.stderr ?? ''}`;
const unitTests = number(/^# tests (\d+)$/m, unitText);
const unitFailures = number(/^# fail (\d+)$/m, unitText) ?? 0;
const unitDuration = number(/^# duration_ms ([\d.]+)$/m, unitText);
const unitCoverage = number(/^# all files\s+\|\s+([\d.]+)/m, unitText);

rmSync(join(root, 'e2e-results.json'), { force: true });
rmSync(join(root, 'test-results'), { recursive: true, force: true });

const e2e = spawnSync('pnpm', ['exec', 'playwright', 'test', '--config', 'e2e/playwright.config.js'], {
  cwd: root,
  stdio: 'inherit',
});
let e2eResult = null;
if (existsSync(join(root, 'e2e-results.json'))) {
  e2eResult = JSON.parse(readFileSync(join(root, 'e2e-results.json'), 'utf8'));
}
const e2eCoverage = lineCoverage(root, 'http://127.0.0.1:4173');
const metrics = {
  unit:
    unitTests == null
      ? null
      : {
          tests: unitTests,
          failures: unitFailures,
          coverage: unitCoverage,
          measuredAt: stamp(),
          durationSeconds: unitDuration == null ? null : Number((unitDuration / 1000).toFixed(3)),
          perTest: unitDuration == null || !unitTests ? null : Number((unitDuration / 1000 / unitTests).toFixed(4)),
        },
  e2e:
    e2eResult == null
      ? null
      : {
          tests: e2eResult.tests,
          failures: e2eResult.failures,
          coverage: e2eCoverage?.coverage ?? null,
          coveredLines: e2eCoverage?.coveredLines ?? null,
          totalLines: e2eCoverage?.totalLines ?? null,
          measuredAt: e2eResult.measuredAt,
          durationSeconds: e2eResult.durationSeconds,
          perTest: e2eResult.tests
            ? Number((e2eResult.durationSeconds / e2eResult.tests).toFixed(4))
            : null,
        },
};
writeFileSync(join(root, 'site', 'test-metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
console.log(`unit: ${metrics.unit?.tests ?? 'not executed'} tests, coverage ${metrics.unit?.coverage ?? 'not measured'} %`);
console.log(`e2e: ${metrics.e2e?.tests ?? 'not executed'} tests, coverage ${metrics.e2e?.coverage ?? 'not measured'} %`);
const missing = (metrics.unit?.tests ?? 0) > 0 && metrics.unit?.coverage == null;
const e2eMissing = (metrics.e2e?.tests ?? 0) > 0 && metrics.e2e?.coverage == null;
process.exit(unit.status !== 0 || e2e.status !== 0 || missing || e2eMissing ? 1 : 0);
