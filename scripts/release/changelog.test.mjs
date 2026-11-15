import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSections, headerDate, extractBullets, extractBlurb, releasedChangelogJson, hasEntriesFor, cutUnreleased } from './changelog.mjs';
import { compareVersions, sliceSections, hasUnseenNotes, renderBullet, seenVersionOnInstall } from '../../src/Universal/Changelog/changelog.js';

const SAMPLE = `<!-- contract -->

# Changelog

## Unreleased

- **Draft.** Not shipped yet.

## 1.2.1 — 2026-11-09

*Security fixes.*

- **One.** First.
- **Two.** Second with \`code\`.
  - nested, ignored

## 1.10.0 — 2026-12-01

- **Ten.** Tenth.

## Typo header

- **Dropped.** Never seen.

## 1.2.0 — 2026-11-08
`;

test('parseSections keeps version and Unreleased sections and drops other headers', () => {
	assert.deepEqual(parseSections(SAMPLE).map((s) => s.kind === 'unreleased' ? 'Unreleased' : s.version), ['Unreleased', '1.2.1', '1.10.0', '1.2.0']);
});

test('headers, bullets and blurb are read', () => {
	const s = parseSections(SAMPLE)[1];
	assert.equal(headerDate(s.raw), '2026-11-09');
	assert.deepEqual(extractBullets(s.raw), ['**One.** First.', '**Two.** Second with `code`.']);
	assert.equal(extractBlurb(s.raw), 'Security fixes.');
	assert.equal(extractBlurb(parseSections(SAMPLE)[2].raw), null);
});

test('releasedChangelogJson leaves Unreleased out', () => {
	const out = JSON.parse(releasedChangelogJson(SAMPLE));
	assert.deepEqual(out.sections.map((s) => s.version), ['1.2.1', '1.10.0', '1.2.0']);
	assert.ok(!JSON.stringify(out).includes('Draft'));
});

test('hasEntriesFor needs a version section with bullets', () => {
	assert.equal(hasEntriesFor(SAMPLE, '1.2.1'), true);
	assert.equal(hasEntriesFor(SAMPLE, '1.2.0'), false);   // heading only
	assert.equal(hasEntriesFor(SAMPLE, '1.3.0'), false);
	assert.equal(hasEntriesFor(SAMPLE, 'Unreleased'), false);
});

test('cutUnreleased moves the bullets into a dated section and leaves an empty Unreleased', () => {
	const { content, moved } = cutUnreleased(SAMPLE, '1.3.0', '2027-01-02', 'Big one');
	assert.equal(moved, 1);
	assert.match(content, /## Unreleased\n\n## 1\.3\.0 — 2027-01-02\n\n\*Big one\*\n\n- \*\*Draft\.\*\* Not shipped yet\.\n\n## 1\.2\.1/);
	assert.deepEqual(extractBullets(parseSections(content)[0].raw), []);
	assert.equal(hasEntriesFor(content, '1.3.0'), true);
});

test('cutUnreleased keeps a blurb already written under Unreleased', () => {
	const text = '# C\n\n## Unreleased\n\n*Mine*\n\n- **A.** a\n';
	const { content } = cutUnreleased(text, '2.0.0', '2027-01-02', 'From the bump');
	assert.ok(content.includes('*Mine*') && !content.includes('From the bump'));
});

test('cutUnreleased warns on an empty or missing Unreleased and refuses a duplicate version', () => {
	assert.ok(cutUnreleased('# C\n\n## Unreleased\n\n## 1.0.0 — 2026-01-01\n\n- **A.** a\n', '1.1.0', '2027-01-01').warning);
	assert.ok(cutUnreleased('# C\n\n## 1.0.0 — 2026-01-01\n\n- **A.** a\n', '1.1.0', '2027-01-01').warning);
	assert.throws(() => cutUnreleased(SAMPLE, '1.2.1', '2027-01-01'), /already has/);
});

test('compareVersions compares numbers, not strings', () => {
	assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
	assert.ok(compareVersions('1.2', '1.2.0') === 0);
	assert.ok(compareVersions('1.2.1', '1.2.0') > 0);
	assert.ok(compareVersions('junk', '0.0.1') < 0);
});

test('sliceSections returns versions after lastSeen up to the running one, newest first', () => {
	const sections = JSON.parse(releasedChangelogJson(SAMPLE)).sections;
	assert.deepEqual(sliceSections(sections, '1.2.0', '1.10.0').map((s) => s.version), ['1.10.0', '1.2.1']);
	assert.deepEqual(sliceSections(sections, '1.2.0', '1.2.1').map((s) => s.version), ['1.2.1']);
	assert.deepEqual(sliceSections(sections, null, '1.10.0'), []);
});

test('the dot needs a newer version with bullets in range', () => {
	const sections = JSON.parse(releasedChangelogJson(SAMPLE)).sections;
	assert.equal(hasUnseenNotes(sections, '1.2.0', '1.2.1'), true);
	assert.equal(hasUnseenNotes(sections, '1.2.1', '1.2.1'), false);
	assert.equal(hasUnseenNotes(sections, null, '1.2.1'), false);
	assert.equal(hasUnseenNotes(sections, '1.2.1', '1.3.0'), false);   // no 1.3.0 notes bundled
	assert.equal(hasUnseenNotes([{ version: '1.3.0', bullets: [] }], '1.2.1', '1.3.0'), false);
});

test('renderBullet turns only **bold** and `code` into segments and never makes markup', () => {
	assert.deepEqual(renderBullet('**Hi.** Use `/note` <b>x</b>'), [
		{ type: 'bold', text: 'Hi.' }, { type: 'text', text: ' Use ' }, { type: 'code', text: '/note' }, { type: 'text', text: ' <b>x</b>' },
	]);
	assert.deepEqual(renderBullet('<img src=x onerror=alert(1)> **'), [{ type: 'text', text: '<img src=x onerror=alert(1)> **' }]);
});

test('seenVersionOnInstall: fresh install is seen, an update from 1.2.1 is not', () => {
	assert.equal(seenVersionOnInstall({ reason: 'install' }, undefined, '1.3.0'), '1.3.0');
	assert.equal(seenVersionOnInstall({ reason: 'update', previousVersion: '1.2.1' }, undefined, '1.3.0'), '1.2.1');
	assert.equal(seenVersionOnInstall({ reason: 'update', previousVersion: '1.2.1' }, '1.2.5', '1.3.0'), null);
	assert.equal(seenVersionOnInstall({ reason: 'chrome_update' }, undefined, '1.3.0'), null);
});

test('the real CHANGELOG.md has notes for the manifest version and a draft Unreleased', () => {
	const text = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
	const { version } = JSON.parse(readFileSync(new URL('../../src/Static/manifest.chrome.json', import.meta.url), 'utf8'));
	assert.equal(hasEntriesFor(text, version), true);
	assert.equal(parseSections(text)[0].kind, 'unreleased');
});
