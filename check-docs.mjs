// The deployed documents are copies of the root sources. A difference is a
// documentation bug, not a build detail.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const sources = [
  'README.md',
  'RELEASE-NOTES.md',
  'docs/APP-SPECS.md',
  'docs/BASIC-SPECS.md',
];
const errors = [];
for (const source of sources) {
  const deployed = join(root, 'site', 'docs', source.replace(/^docs\//, ''));
  if (!existsSync(deployed)) {
    errors.push(`missing deployed copy: ${source}`);
    continue;
  }
  if (readFileSync(join(root, source), 'utf8') !== readFileSync(deployed, 'utf8')) {
    errors.push(`deployed copy differs: ${source}`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(`check-docs: ${error}`);
  process.exit(1);
}
console.log(`check-docs: ${sources.length} documents match.`);
