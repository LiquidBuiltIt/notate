import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextVersion, setVersion, bumpLockfile, uploadOutcome } from './helpers.mjs';

test('nextVersion treats a two-part store version as patch 0', () => {
  assert.equal(nextVersion('1.1', 'patch'), '1.1.1');
  assert.equal(nextVersion('1.1', 'minor'), '1.2.0');
  assert.equal(nextVersion('1.1', 'major'), '2.0.0');
  assert.equal(nextVersion('1.2.9', 'patch'), '1.2.10');
});

test('nextVersion rejects bad input', () => {
  assert.throws(() => nextVersion('1.x', 'patch'));
  assert.throws(() => nextVersion('1.1', 'rollback'));
});

test('setVersion changes only the top-level version and keeps formatting', () => {
  const before = '{\n\t"manifest_version": 3,\n\t"version":   "1.1",\n\t"nested": { "version": "9" }\n}\n';
  assert.equal(setVersion(before, '1.2.0'), before.replace('"version":   "1.1"', '"version": "1.2.0"'));
  assert.throws(() => setVersion('{"name":"x"}', '1.2.0'));
});

test('bumpLockfile moves the root entries only', () => {
  const lock = { version: '1', packages: { '': { version: '1' }, 'node_modules/a': { version: '7' } } };
  const out = JSON.parse(bumpLockfile(JSON.stringify(lock), '2.0.0'));
  assert.equal(out.version, '2.0.0');
  assert.equal(out.packages[''].version, '2.0.0');
  assert.equal(out.packages['node_modules/a'].version, '7');
});

test('store credentials stay gitignored', () => {
  const lines = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8').split('\n');
  for (const rule of ['.cws-token', 'client_secret_*.json']) assert.ok(lines.includes(rule), rule);
});

test('uploadOutcome fails closed', () => {
  assert.equal(uploadOutcome('SUCCEEDED'), 'done');
  assert.equal(uploadOutcome('UPLOAD_IN_PROGRESS'), 'wait');
  assert.equal(uploadOutcome('IN_PROGRESS'), 'wait');
  for (const state of ['FAILED', 'NOT_FOUND', undefined]) assert.equal(uploadOutcome(state), 'failed');
});
