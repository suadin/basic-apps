import assert from 'node:assert/strict';
import { test } from 'node:test';

import { driftText, folderCount, folderLine, repoRows, stamp, visibleFolders } from '../site/logic.js';

const FOLDERS = [
  { name: 'repos', public: true, text: 'projects', entries: ['one', 'two'], count: 2 },
  { name: 'skills', public: false, text: 'capabilities', entries: ['a'], count: 1 },
  { name: 'secrets', public: false, text: 'tokens', entries: null, count: null },
  { name: 'scratch', public: false, text: 'throwaway', entries: [], count: 0 },
];

test('visibleFolders keeps every folder in mode a and only public ones in mode b', () => {
  assert.deepEqual(visibleFolders({ folders: FOLDERS }, 'a').map((f) => f.name), ['repos', 'skills', 'secrets', 'scratch']);
  assert.deepEqual(visibleFolders({ folders: FOLDERS }, 'b').map((f) => f.name), ['repos']);
  assert.deepEqual(visibleFolders(null, 'a'), []);
});

test('folderLine tells a closed folder from an empty one', () => {
  assert.equal(folderLine(FOLDERS[2]), 'existence only');
  assert.equal(folderLine(FOLDERS[3]), 'empty');
  assert.equal(folderLine(FOLDERS[0]), 'one · two');
  assert.equal(folderCount(FOLDERS[2]), '—');
  assert.equal(folderCount(FOLDERS[3]), '0');
});

test('stamp normalises the scan time and survives a missing value', () => {
  assert.equal(stamp('2026-10-29T11:45'), '2026-10-29 11:45');
  assert.equal(stamp(undefined), '—');
  assert.equal(stamp('yesterday'), '—');
});

test('repoRows sorts by name and names the restore state', () => {
  const rows = repoRows({
    repos: [
      { name: 'zeta', appVersion: '1.0.0', standard: '1.1.1', deviations: 2, lastCommit: '2026-10-28', remote: true, restored: true },
      { name: 'alpha', appVersion: null, standard: null, deviations: 0, lastCommit: null, remote: false, localOnly: true },
    ],
  });
  assert.deepEqual(rows.map((row) => row.name), ['alpha', 'zeta']);
  assert.deepEqual(rows[0], {
    name: 'alpha',
    app: '—',
    standard: '—',
    deviations: '—',
    lastCommit: '—',
    origin: 'none',
    restore: 'local only',
  });
  assert.equal(rows[1].deviations, '2');
  assert.equal(rows[1].origin, 'set');
  assert.equal(rows[1].restore, 'repos.txt');
  assert.deepEqual(repoRows(null), []);
});

test('driftText counts differences and says so plainly', () => {
  assert.match(driftText(null), /No state file/);
  assert.match(driftText({ drift: [] }), /^None\./);
  assert.equal(driftText({ drift: ['one'] }), '1 difference between the descriptions and the disk');
  assert.equal(driftText({ drift: ['one', 'two'] }), '2 differences between the descriptions and the disk');
});
