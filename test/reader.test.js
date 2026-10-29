import assert from 'node:assert/strict';
import test from 'node:test';
import {
  escapeHtml,
  iconFor,
  parseRoute,
  renderMarkdown,
  slugify,
  splitDocument,
  uniqueIcons,
} from '../site/reader.js';
import { metricLabel, pageWindow, parseMode, tipFor } from '../site/logic.js';

test('[BASIC-READER-02] a heading becomes a slug', () => {
  assert.equal(slugify('Install & setup!'), 'install-setup');
});

test('[BASIC-READER-02] a document is split at level-two headings', () => {
  const doc = splitDocument({
    slug: 'readme',
    title: 'README',
    markdown: '# Demo\n\nHello.\n\n## Install\n\nText.\n',
  });
  assert.deepEqual(doc.pages.map((page) => page.title), ['Overview', 'Install']);
  assert.equal(doc.pages[1].markdown, 'Text.');
});

test('[BASIC-READER-03] sections pick an icon and fall back to a dot', () => {
  assert.equal(iconFor('Install'), 'install');
  assert.equal(iconFor('Something unknown'), 'dot');
  assert.equal(new Set(uniqueIcons(['Install', 'Install', 'Tests'])).size, 3);
});

test('[BASIC-READER-04] html is escaped before markup is added', () => {
  assert.equal(escapeHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  assert.match(renderMarkdown('**bold** and `code`'), /<strong>bold<\/strong>/);
});

test('[BASIC-LINKS-01] mode lives in the address', () => {
  assert.equal(parseMode('#/mode/b'), 'b');
  assert.equal(parseMode(''), 'a');
  assert.deepEqual(parseRoute('#/docs/readme/install'), {
    view: 'docs',
    doc: 'readme',
    section: 'install',
  });
});

test('[BASIC-FOOTER-02] metric labels show count and coverage', () => {
  assert.equal(metricLabel('Unit', { tests: 29, coverage: 95.63, failures: 0 }), 'Unit 29 · 95.63 %');
  assert.equal(metricLabel('E2E', null), 'E2E not executed');
  assert.match(tipFor({ measuredAt: '2026-10-27T18:15', durationSeconds: 0.4, perTest: 0.01 }), /Measured/);
  assert.deepEqual(pageWindow(12, 2, 5), { pages: 3, current: 2, start: 5, end: 10 });
});
