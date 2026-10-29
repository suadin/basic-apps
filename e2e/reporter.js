import { writeFileSync } from 'node:fs';

function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default class MetricsReporter {
  tests = 0;
  failures = 0;
  durationMs = 0;

  onTestEnd(_test, result) {
    if (result.status === 'skipped') return;
    this.tests += 1;
    this.durationMs += result.duration;
    if (['failed', 'timedOut', 'interrupted'].includes(result.status)) this.failures += 1;
  }

  onEnd() {
    writeFileSync(
      'e2e-results.json',
      `${JSON.stringify(
        {
          tests: this.tests,
          failures: this.failures,
          durationSeconds: Number((this.durationMs / 1000).toFixed(3)),
          measuredAt: stamp(),
        },
        null,
        2,
      )}\n`,
    );
  }
}
