import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appVersionTip,
  basicVersionTip,
  compareVersions,
  parseVersion,
  updateState,
} from '../site/version.js';

test('[BASIC-VERSION-01] the app version has a SPECS tooltip', () => {
  assert.equal(appVersionTip('Template', '1.0.0'), 'Template 1.0.0 — open SPECS');
});

test('[BASIC-VERSION-02] the Basic Specs version has a Basic Specs tooltip', () => {
  assert.equal(basicVersionTip('1.1.0', '1.1.0', 'current'), 'Basic Specs 1.1.0 — current');
});

test('[BASIC-VERSION-03] only major updates are red', () => {
  assert.deepEqual(parseVersion('1.2.3'), [1, 2, 3]);
  assert.equal(compareVersions('1.2.3', '1.2.2'), 1);
  assert.equal(updateState('1.0.2', '1.1.0'), 'newer');
  assert.equal(updateState('1.0.2', '1.0.3'), 'newer');
  assert.equal(updateState('1.0.2', '2.0.0'), 'major');
  assert.equal(updateState('1.0.2', '1.0.2'), 'current');
  assert.equal(updateState('1.0.2', null), 'unknown');
  assert.match(basicVersionTip('1.0.2', '2.0.0', 'major'), /2\.0\.0 available/);
});

test('[BASIC-VERSION-04] the latest version is compared as semver', () => {
  assert.equal(updateState('1.0.2', '1.0.1'), 'current');
  assert.equal(updateState('1.0.2', 'garbage'), 'unknown');
});
