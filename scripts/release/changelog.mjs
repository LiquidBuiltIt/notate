/**
 * Changelog parsing for the release scripts and the build. No dependencies.
 * The format is described in the comment at the top of CHANGELOG.md.
 *
 * CLI (used by the build): node scripts/release/changelog.mjs <CHANGELOG.md> <out.json>
 * writes the released sections as JSON. Unreleased never ships.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION_HEADER = /^##\s+v?(\d+)\.(\d+)\.(\d+)\b/;
const UNRELEASED_HEADER = /^##\s+Unreleased\s*$/i;

/** Split into `## ` sections. Any other `## ` header is dropped, as the contract says. */
export function parseSections(text) {
	const sections = [];
	let current = null;
	const flush = () => {
		if (!current) return;
		const raw = current.join('\n').replace(/\n+$/, '');
		const vm = current[0].match(VERSION_HEADER);
		if (vm) sections.push({ kind: 'version', version: `${vm[1]}.${vm[2]}.${vm[3]}`, raw });
		else if (UNRELEASED_HEADER.test(current[0])) sections.push({ kind: 'unreleased', raw });
		current = null;
	};
	for (const line of text.split('\n')) {
		if (line.startsWith('## ')) { flush(); current = [line]; }
		else if (current) current.push(line);
	}
	flush();
	return sections;
}

/** `## 1.2.1 — 2026-11-09` gives `2026-11-09`, or null. */
export function headerDate(raw) {
	const m = raw.split('\n', 1)[0].match(/—\s*(.+?)\s*$/);
	return m ? m[1] : null;
}

/** Top-level bullets only. Nested bullets are ignored. */
export function extractBullets(raw) {
	return raw.split('\n').flatMap((line) => {
		const m = line.match(/^[-*]\s+(.*)$/);
		return m ? [m[1].trim()] : [];
	});
}

/** The optional `*blurb*` line under the heading, before any bullet. */
export function extractBlurb(raw) {
	for (const line of raw.split('\n').slice(1).map((l) => l.trim())) {
		if (line === '') continue;
		if (/^\*[^*].*[^*]\*$/.test(line)) return line.slice(1, -1).trim();
		return null;
	}
	return null;
}

/** Released sections as the JSON the new tab reads, in file order (newest first). */
export function releasedChangelogJson(text) {
	const sections = parseSections(text)
		.filter((s) => s.kind === 'version')
		.map((s) => ({ version: s.version, date: headerDate(s.raw), blurb: extractBlurb(s.raw), bullets: extractBullets(s.raw) }));
	return JSON.stringify({ sections }, null, 2) + '\n';
}

/** True when CHANGELOG text has a section for `version` with at least one bullet. */
export function hasEntriesFor(text, version) {
	return parseSections(text).some((s) => s.kind === 'version' && s.version === version && extractBullets(s.raw).length > 0);
}

/**
 * Move the bullets under `## Unreleased` into a new `## version — date` section and leave a
 * fresh empty Unreleased. Returns { content, moved }, or { warning } when there is nothing to
 * move (the bump goes on). Throws when the version already has a section.
 */
export function cutUnreleased(content, version, date, blurb = '') {
	const lines = content.split('\n');
	if (lines.some((l) => { const m = l.match(VERSION_HEADER); return m && `${m[1]}.${m[2]}.${m[3]}` === version; })) {
		throw new Error(`CHANGELOG.md already has a "## ${version}" section.`);
	}
	const start = lines.findIndex((l) => UNRELEASED_HEADER.test(l));
	if (start === -1) return { warning: 'No "## Unreleased" section in CHANGELOG.md, so no changelog entry was made.' };
	let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
	if (end === -1) end = lines.length;
	const body = lines.slice(start + 1, end);
	while (body.length && body[0].trim() === '') body.shift();
	while (body.length && body[body.length - 1].trim() === '') body.pop();
	if (!extractBullets(body.join('\n')).length) return { warning: '"## Unreleased" has no bullets, so no changelog entry was made.' };
	const tail = lines.slice(end);
	const trimmed = blurb.trim();
	const out = [
		...lines.slice(0, start + 1), '',
		`## ${version} — ${date}`, '',
		// A blurb the author already wrote under Unreleased wins over the bump message.
		...(trimmed && extractBlurb(`## x\n${body.join('\n')}`) === null ? [`*${trimmed}*`, ''] : []),
		...body,
		...(tail.length ? ['', ...tail] : ['']),
	];
	return { content: out.join('\n'), moved: extractBullets(body.join('\n')).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [src, dest] = process.argv.slice(2);
	if (!src || !dest) { console.error('Usage: changelog.mjs <CHANGELOG.md> <out.json>'); process.exit(1); }
	const json = releasedChangelogJson(readFileSync(src, 'utf8'));
	writeFileSync(dest, json);
	console.log(`changelog.json: ${JSON.parse(json).sections.length} released version(s)`);
}
