/**
 * Changelog parsing for the release scripts and the build. No dependencies.
 * The format is described in the comment at the top of CHANGELOG.md.
 *
 * Reader CLI: npm run changelog -- [latest|unreleased|x.y.z|x.y|ls|json] [-v] [--out <path>]
 * Run it with --help for the full usage.
 *
 * Build CLI (kept as is, called by mv-manifest.sh): node scripts/release/changelog.mjs <CHANGELOG.md> <out.json>
 * writes the released sections as JSON. Unreleased never ships. The `json` command of the
 * reader CLI is different: it also lists Unreleased (version "Unreleased", date null).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

/** "3", "3.2", "v3.2.1" gives padded [major, minor, patch], or null. */
export function parseQuery(q) {
	const m = q.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
	return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

const distance = (a, b) => Math.abs(a[0] - b[0]) * 1e6 + Math.abs(a[1] - b[1]) * 1e3 + Math.abs(a[2] - b[2]);

/**
 * Pick the version section for a query. `versions` is newest first. A partial query ("1.2")
 * takes the newest version that starts with it. Otherwise an exact match wins, else the
 * closest one (the newest wins a tie), which comes back with a `note`.
 */
export function resolveVersion(versions, arg) {
	const q = parseQuery(arg);
	if (!q || !versions.length) return null;
	const prefix = arg.replace(/^v/, '');
	if (prefix.split('.').length < 3) {
		const hit = versions.find((v) => v.version.startsWith(`${prefix}.`));
		if (hit) return { section: hit, note: '' };
	}
	const dist = (v) => distance(q, v.version.split('.').map(Number));
	let best = versions[0];
	for (const v of versions) if (dist(v) < dist(best)) best = v;
	return { section: best, note: dist(best) > 0 ? `'${arg}' not found — showing closest: ${best.version}` : '' };
}

/** The one-line statement of a bullet: its leading **bold** phrase, else its first sentence. */
export function summarize(bullet) {
	const t = bullet.trim();
	if (t.startsWith('**')) {
		const end = t.indexOf('**', 2);
		if (end !== -1) return t.slice(2, end).trim();
	}
	const m = t.match(/^(.*?[.!?])(\s|$)/);
	return (m ? m[1] : t).trim();
}

const countLabel = (n) => `(${n} item${n === 1 ? '' : 's'})`;

/** A section as compact Markdown: the header with its item count, the blurb, one line per bullet. */
export function compactSection(raw) {
	const bullets = extractBullets(raw);
	const title = raw.split('\n', 1)[0].replace(/^##\s+/, '').trim();
	const blurb = extractBlurb(raw);
	return `## ${title} ${countLabel(bullets.length)}\n\n${blurb ? `*${blurb}*\n\n` : ''}${bullets.map((b) => `- ${summarize(b)}`).join('\n')}`;
}

/** The `ls` table: aligned version, date, item count. Unreleased leads when present. */
export function versionList(sections) {
	const rows = sections.map((s) => [
		s.kind === 'unreleased' ? 'Unreleased' : s.version,
		s.kind === 'unreleased' ? 'in flight' : headerDate(s.raw) ?? '',
		countLabel(extractBullets(s.raw).length),
	]);
	if (!rows.length) return '(no versions)';
	const w = [0, 1].map((c) => Math.max(...rows.map((r) => r[c].length)));
	const released = sections.filter((s) => s.kind === 'version').length;
	const head = `Available versions — ${released} released${sections.some((s) => s.kind === 'unreleased') ? ' + Unreleased' : ''}`;
	return [head, ...rows.map((r) => `  ${r[0].padEnd(w[0])}  ${r[1].padEnd(w[1])}  ${r[2]}`)].join('\n');
}

/** Every section as JSON for the `json` command: Unreleased included, Markdown left in the bullets. */
export function sectionsJson(sections) {
	return JSON.stringify({
		sections: sections.map((s) => ({
			version: s.kind === 'unreleased' ? 'Unreleased' : s.version,
			date: s.kind === 'unreleased' ? null : headerDate(s.raw),
			blurb: extractBlurb(s.raw),
			bullets: extractBullets(s.raw),
		})),
	}, null, 2);
}

export const USAGE = [
	'Usage: npm run changelog -- <latest|unreleased|x.y.z|x.y|ls|json> [-v|--verbose] [--out <path>]',
	'',
	'  latest         newest released version (default when no argument)',
	'  unreleased     the ## Unreleased section',
	'  x.y.z, x.y     a specific version; auto-corrects to the closest if not found',
	'  ls, list       list the versions with their dates',
	'  json           every section as JSON ({ sections: [...] }); stdout, or --out <path>',
	'  -v, --verbose  full entry text (default: one-line statements only)',
].join('\n');

/** argv (without node and the script) to { help, verbose, out, arg }. The flags may sit anywhere. */
export function parseArgs(argv) {
	const out = { help: false, verbose: false, out: undefined, arg: 'latest' };
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '-h' || a === '--help' || a === 'help') out.help = true;
		else if (a === '-v' || a === '--verbose') out.verbose = true;
		else if (a === '--out') out.out = argv[++i] ?? null;
		else positional.push(a);
	}
	if (positional[0]?.trim()) out.arg = positional[0].trim();
	return out;
}

function fail(message, usage = false) {
	console.error(message);
	if (usage) console.error(`\n${USAGE}`);
	process.exit(1);
}

function main(argv) {
	// The build call: <CHANGELOG.md> <out.json>. Released sections only.
	if (argv.length === 2 && argv[0].endsWith('.md')) {
		const json = releasedChangelogJson(readFileSync(argv[0], 'utf8'));
		writeFileSync(argv[1], json);
		console.log(`changelog.json: ${JSON.parse(json).sections.length} released version(s)`);
		return;
	}
	const opts = parseArgs(argv);
	if (opts.help) return console.log(USAGE);
	if (opts.out === null) fail('--out needs a path.', true);
	const file = fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url));
	let sections;
	try { sections = parseSections(readFileSync(file, 'utf8')); } catch { fail(`Could not read CHANGELOG.md at ${file}`); }
	const versions = sections.filter((s) => s.kind === 'version');
	const unreleased = sections.find((s) => s.kind === 'unreleased');
	const arg = opts.arg.toLowerCase();

	if (arg === 'ls' || arg === 'list') return console.log(versionList(sections));
	if (arg === 'json') {
		const json = sectionsJson(sections);
		if (opts.out) writeFileSync(resolve(opts.out), json + '\n');
		else console.log(json);
		return;
	}

	let chosen, note = '';
	if (arg === 'latest') {
		chosen = versions[0] ?? unreleased;
		if (!versions[0] && unreleased) note = 'No released versions yet — showing Unreleased.';
	} else if (arg === 'unreleased') {
		chosen = unreleased;
		if (!chosen) fail('No ## Unreleased section in CHANGELOG.md');
	} else {
		if (!parseQuery(arg)) fail(`Unrecognized argument: '${opts.arg}'`, true);
		if (!versions.length) fail('No released versions in CHANGELOG.md');
		({ section: chosen, note } = resolveVersion(versions, arg));
	}
	if (!chosen) fail('Nothing to show.');
	if (note) console.error(`⚠ ${note}`);
	console.log(opts.verbose ? chosen.raw : compactSection(chosen.raw));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
