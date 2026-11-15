/**
 * Pure helpers for the "What's new" panel and the background install hook.
 * No imports, so the release tests can load this file directly.
 * Data comes from changelog.json, which the build writes from CHANGELOG.md.
 */

const parse = (v) => {
	const m = String(v ?? '').trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
	return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null
}

/** Numeric compare of "x.y.z": negative if a < b. Not string order, so 1.10.0 is above 1.9.0. Junk sorts lowest. */
export function compareVersions(a, b) {
	const pa = parse(a), pb = parse(b)
	if (!pa || !pb) return pa ? 1 : pb ? -1 : 0
	return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2]
}

/** Sections newer than `from` (exclusive) up to `current` (inclusive), newest first. A null `from` gives none. */
export function sliceSections(sections, from, current) {
	if (!Array.isArray(sections) || parse(from) === null) return []
	return sections
		.filter((s) => compareVersions(s.version, from) > 0 && compareVersions(s.version, current) <= 0)
		.sort((a, b) => compareVersions(b.version, a.version))
}

/** The red dot rule: a newer version than the one seen, and release notes with bullets in that range. */
export function hasUnseenNotes(sections, lastSeen, current) {
	return sliceSections(sections, lastSeen, current).some((s) => s.bullets?.length > 0)
}

/** All sections, newest first. */
export const newestFirst = (sections) => [...sections].sort((a, b) => compareVersions(b.version, a.version))

/**
 * A bullet as plain segments: text, **bold** and `code`. The caller renders them as text,
 * so no markup from the changelog ever reaches the page as HTML.
 */
export function renderBullet(text) {
	return String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
		part.startsWith('`') && part.endsWith('`') && part.length > 2 ? { type: 'code', text: part.slice(1, -1) }
		: part.startsWith('**') && part.endsWith('**') && part.length > 4 ? { type: 'bold', text: part.slice(2, -2) }
		: { type: 'text', text: part })
}

/**
 * What the background stores as lastSeenVersion when the extension is installed or updated,
 * or null to store nothing. A fresh install has seen everything. An update from a version that
 * never stored a value (1.2.1 and older) counts as seen up to the previous version, so the dot shows.
 */
export function seenVersionOnInstall({ reason, previousVersion }, lastSeen, current) {
	if (reason === 'install') return current
	if (reason === 'update' && !lastSeen && previousVersion) return previousVersion
	return null
}
