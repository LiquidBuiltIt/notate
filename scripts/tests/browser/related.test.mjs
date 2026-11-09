import { test } from 'node:test'
import assert from 'node:assert/strict'

// Pure source module: no DOM needed beyond window.location.
const { getNoteURLComparison } = await import('../../../src/Content/Components/RelatedNotesViewer/algorithms/RelatedNotesAlgoritm.js')

const compare = (hostname, pathname, origins) => {
	globalThis.window = { location: { hostname, pathname } }
	const r = getNoteURLComparison({ inventory: { NOTES: origins.map((origin) => ({ origin })) } })
	const lists = (k) => r[k].map((n) => n.origin)
	return { full: lists('fullMatchList'), domain: lists('domainMatchList'), partial: lists('partialMatchList'), none: lists('noMatchList') }
}

test('a page path cannot pull in another host\'s notes', () => {
	const r = compare('evil.com', '/a', ['notevil.com/abc', 'evil.com.attacker.net/a', 'bank.com/evil.com/a', 'bank.com/a'])
	assert.deepEqual([r.full, r.domain, r.partial], [[], [], []])
	assert.equal(r.none.length, 4)
})

test('exact host and path still match', () => {
	const r = compare('example.com', '/a', ['example.com/a', 'example.com/b', 'example.com/'])
	assert.deepEqual(r.full, ['example.com/a'])
	assert.deepEqual(r.domain, ['example.com/b', 'example.com/'])
})
