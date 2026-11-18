import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { crc32 } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, startFixture, openFixture, openContextMenu, ui, waitFor, sleep, EXT_ID } from './helper.mjs'
import { zip } from '../../../src/Universal/Utils/zip.js'

const NEWTAB = `chrome-extension://${EXT_ID}/notate.html`
let b, fx, dir

beforeEach(async () => {
	fx = await startFixture(); b = await launch()
	dir = mkdtempSync(join(tmpdir(), 'notate-dl-'))
	await b.cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir })
})
afterEach(async () => { await b.close(); fx.close(); rmSync(dir, { recursive: true, force: true }) })

const config = async () => (await b.idb()).USER_CONFIGURATION_DB?.USER_CONFIGURATION?.[0]
const idb = async () => (await b.idb()).NOTATE_DB
const color = { name: 'yellow', styles: { card: 'bg-yellow-200', top: 'bg-yellow-400' } }
const when = '2026-01-02T03:04:05.000Z'
const plant = async (notes, books = []) => {
	await b.serviceWorker(); await waitFor(config, 'seeded config')
	for (const n of notes) await b.post('notate', 'NOTES', { origin: 'example.com/page', color, created: when, modified: when, ...n })
	for (const k of books) await b.post('notate', 'NOTEBOOKS', { description: '', created: when, modified: when, ...k })
}
// The one file the page downloaded.
const downloaded = async () => {
	const name = await waitFor(() => { const f = readdirSync(dir).filter((x) => !x.endsWith('.crdownload')); return f.length === 1 && f[0] }, 'a downloaded file')
	return { name, path: join(dir, name), bytes: readFileSync(join(dir, name)) }
}

// A minimal zip reader: the central directory, store-only entries, UTF-8 flag and CRC checked.
function readZip(buf) {
	const eocd = buf.length - 22
	assert.equal(buf.readUInt32LE(eocd), 0x06054b50, 'end of central directory')
	const count = buf.readUInt16LE(eocd + 10)
	let p = buf.readUInt32LE(eocd + 16)
	const out = new Map()
	for (let i = 0; i < count; i++) {
		assert.equal(buf.readUInt32LE(p), 0x02014b50)
		const [flags, method, crc, size, nameLen, local] = [buf.readUInt16LE(p + 8), buf.readUInt16LE(p + 10), buf.readUInt32LE(p + 16), buf.readUInt32LE(p + 24), buf.readUInt16LE(p + 28), buf.readUInt32LE(p + 42)]
		const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
		assert.equal(flags & 0x0800, 0x0800, 'UTF-8 flag'); assert.equal(method, 0, 'stored')
		assert.equal(buf.readUInt32LE(local), 0x04034b50)
		const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
		const data = buf.subarray(start, start + size)
		assert.equal(crc32(data), crc, `crc of ${name}`)
		out.set(name, data.toString('utf8'))
		p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)
	}
	return out
}

async function openNote(id) {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear(`#note-card-${id}`)
	await n.click(`#note-card-${id}`)
	await n.appear('#export-note-btn')
	return { page, n }
}

test('zip writer: a file made in the browser-free path is read back by Python and a minimal reader', async () => {
	const blob = zip([{ name: 'a/é ü.txt', data: 'héllo' }, { name: 'empty', data: new Uint8Array() }, { name: 'big.bin', data: new Uint8Array(200000).map((_, i) => i * 7) }])
	const file = join(dir, 'x.zip'); const buf = Buffer.from(await blob.arrayBuffer()); writeFileSync(file, buf)
	const entries = readZip(buf)
	assert.deepEqual([...entries.keys()], ['a/é ü.txt', 'empty', 'big.bin'])
	assert.equal(entries.get('a/é ü.txt'), 'héllo')
	execFileSync('python3', ['-I', '-m', 'zipfile', '-t', file])
})

test('export note: bold, italic, strike, lists, checklist, headings, quote, link and image become Markdown', async () => {
	await plant([{ id: 1, title: 'Planted', content: '<div>hello <b>bold</b> and <i>it</i> <s>gone</s> <u>und</u></div><ul><li>one</li><li>two</li></ul><ul><li data-checked="true">done</li><li data-checked="false">todo</li></ul>'
		+ '<h1>Big</h1><h2>Small</h2><blockquote>said</blockquote><div><a href="https://example.com/a b(c)">link</a></div><div><img src="data:image/png;base64,iVBORw0KGgo="></div>' }])
	const { n } = await openNote(1)
	await n.click('#export-note-btn')
	const f = await downloaded()
	assert.equal(f.name, 'Planted.md')
	assert.equal(f.bytes.toString(), '# Planted\n\nSource: example.com/page\n\nhello **bold** and *it* ~~gone~~ und\n\n- one\n- two\n\n- [x] done\n- [ ] todo\n\n# Big\n\n## Small\n\n> said\n\n[link](https://example.com/a%20b%28c%29)\n\n![](data:image/png;base64,iVBORw0KGgo=)\n')
	assert.deepEqual(b.errors, [])
})

test('export note: a note made on the new tab has no Source line', async () => {
	await plant([{ id: 1, title: 'Mine', content: '<div>text</div>', origin: `${EXT_ID}/notate.html` }])
	const { n } = await openNote(1)
	await n.click('#export-note-btn')
	assert.equal((await downloaded()).bytes.toString(), '# Mine\n\ntext\n')
})

test('export note: typed Markdown and HTML stay literal, bad links and images are dropped, and the file name is clean', async () => {
	await plant([{ id: 1, title: 'a/b\\c:d*e?"f<g>h|i\nj', content: '<div>[x](javascript:alert(1)) &lt;img src=x onerror=alert(1)&gt; *star* # not heading</div><div># heading-like</div><div>- dash</div><div>1. num</div>'
		+ '<div><a href="javascript:alert(1)">bad</a></div><div><a href="https://ok.example/">good</a></div>'
		+ '<div><img src="data:image/png;base64,AAAA<script>"></div><div><img src="data:text/html;base64,AAAA"></div><div><img src="data:image/svg+xml;base64,AAAA"></div><div><img src="https://x.example/y.png"></div>' }])
	const { n } = await openNote(1)
	await n.click('#export-note-btn')
	const f = await downloaded()
	assert.equal(f.name, 'abcdefghij.md')
	assert.equal(f.bytes.toString(), '# a/b\\\\c:d\\*e?"f\\<g\\>h|i j\n\nSource: example.com/page\n\n\\[x\\](javascript:alert(1)) \\<img src=x onerror=alert(1)\\> \\*star\\* # not heading\n\n\\# heading-like\n\n\\- dash\n\n1\\. num\n\nbad\n\n[good](https://ok.example/)\n')
})

test('export notebook: title, description, then each note with its source and headings two levels down', async () => {
	await plant([{ id: 1, title: 'Note A', content: '<h1>Part</h1><div>alpha</div>', origin: 'a.example/' }, { id: 2, title: 'Note B', content: '<div>beta</div>', origin: `${EXT_ID}/notate.html` }],
		[{ id: 1, title: 'Book: one/two', description: '# not a heading\nsecond *line*', collection: [2, 1] }])
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#notebook-card-1')
	await n.click('#notebook-card-1')
	await n.click('#export-notebook-btn')
	const f = await downloaded()
	assert.equal(f.name, 'Book onetwo.md')
	assert.equal(f.bytes.toString(), '# Book: one/two\n\n\\# not a heading\n\nsecond \\*line\\*\n\n## Note B\n\nbeta\n\n## Note A\n\nSource: a.example/\n\n### Part\n\nalpha\n')
})

const isDisabled = (page, sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).disabled`)

test('export note: a new, unsaved note has Export greyed like Delete, and a saved note does not', async () => {
	await plant([{ id: 1, title: 'Saved', content: '<div>text</div>' }])
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.hover('#search-bar-tab')
	await n.click('#new-note-button')
	await n.fill('#edit-note-title', 'Draft')
	await n.fill('#input-text-display', 'typed, not saved')
	await n.appear('#export-note-btn')
	assert.equal(await isDisabled(page, '#delete-btn'), true, 'Delete is greyed on a new note')
	assert.equal(await isDisabled(page, '#export-note-btn'), true, 'so is Export')
	await waitFor(() => page.eval(`getComputedStyle(document.querySelector('#export-note-btn')).color === getComputedStyle(document.querySelector('#delete-btn')).color`), 'the same look as Delete')
	await page.eval(`document.querySelector('#export-note-btn').click()`)
	await sleep(700)
	assert.deepEqual(readdirSync(dir), [], 'nothing was downloaded')
	const { page: saved } = await openNote(1)
	assert.equal(await isDisabled(saved, '#export-note-btn'), false)
})

test('export notebook: a new, unsaved notebook has Export greyed, and a saved notebook does not', async () => {
	await plant([], [{ id: 1, title: 'Saved book', collection: [] }])
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.fill('#searchInput', '/notebook')
	for (let i = 0; i < 2; i++) { // the first Enter completes the command name, the second opens the blank notebook
		await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r' })
		await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' })
		await sleep(500)
	}
	await n.appear('#export-notebook-btn')
	assert.equal(await page.eval(`!document.querySelector('#delete-notebook-btn')`), true, 'a new notebook has no Delete')
	assert.equal(await isDisabled(page, '#export-notebook-btn'), true)
	const saved = await b.openPage(NEWTAB)
	const s = ui(saved)
	await s.appear('#notebook-card-1')
	await s.click('#notebook-card-1')
	await s.appear('#export-notebook-btn')
	assert.equal(await isDisabled(saved, '#export-notebook-btn'), false)
})

const KEYS = ['id', 'title', 'color', 'created', 'modified', 'origin', 'notebooks']
// Front matter as a strict YAML subset: exactly seven "key: <JSON>" lines, so a value cannot add a key or leave its line.
function front(md) {
	const [, head, body] = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(md)
	assert.doesNotMatch(head, /[\r\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/, 'no raw control or line-separator character')
	const lines = head.split('\n')
	assert.equal(lines.length, KEYS.length, head)
	return { meta: Object.fromEntries(lines.map((l, i) => { const m = new RegExp(`^${KEYS[i]}: (.*)$`).exec(l); assert.ok(m, l); return [KEYS[i], JSON.parse(m[1])] })), body }
}

test('export all: a valid .notate zip with one folder per notebook, safe front matter and notate.json matching the database', async () => {
	await plant([
		{ id: 1, title: 'Same', content: '<b>one</b>' }, { id: 5, title: 'Same', content: '<i>five</i>' },
		{ id: 2, title: 'Second', content: '<ul><li data-checked="true">t</li></ul>' }, { id: 3, title: 'Both', content: '<div>in two books</div>', board: { x: 10, y: 20, r: 1, z: 3 } },
		{ id: 4, title: 'x\nid: 9\r\n---\u2028evil: 1', content: '<div>loose</div>', origin: null },
	], [{ id: 1, title: 'Alpha', description: 'first', collection: [1, 5, 3] }, { id: 2, title: 'alpha', description: 'second', collection: [2, 3] }, { id: 3, title: 'Unfiled', description: '', collection: [] }])
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.click('#settings-widget')
	await n.appear('#export-all-button')
	await n.center('#save-settings-button') // the pane has stopped sliding in
	await page.eval(`document.querySelector('#export-all-button').scrollIntoView({ block: 'center' })`)
	await n.click('#export-all-button')
	const f = await downloaded()
	assert.match(f.name, /^notate-backup-\d{4}-\d{2}-\d{2}\.notate$/)
	execFileSync('python3', ['-I', '-m', 'zipfile', '-t', f.path])
	const files = readZip(f.bytes)
	assert.deepEqual([...files.keys()].sort(), ['Alpha/Both.md', 'Alpha/Same (2).md', 'Alpha/Same.md', 'Unfiled/xid 9---evil 1.md', 'alpha (2)/Second.md', 'notate.json'])

	const both = front(files.get('Alpha/Both.md'))
	assert.deepEqual(both.meta, { id: '3', title: 'Both', color: 'yellow', created: when, modified: when, origin: 'example.com/page', notebooks: ['1', '2'] })
	assert.equal(both.body, 'in two books\n')
	const loose = front(files.get('Unfiled/xid 9---evil 1.md'))
	assert.deepEqual(loose.meta, { id: '4', title: 'x\nid: 9\r\n---\u2028evil: 1', color: 'yellow', created: when, modified: when, origin: '', notebooks: [] })
	assert.equal(front(files.get('Alpha/Same.md')).body, '**one**\n')
	assert.equal(front(files.get('Alpha/Same (2).md')).meta.id, '5')
	assert.equal(front(files.get('alpha (2)/Second.md')).body, '- [x] t\n')

	const json = JSON.parse(files.get('notate.json'))
	const db = await idb()
	assert.deepEqual(Object.keys(json).sort(), ['exported', 'format', 'notebooks', 'notes', 'version'])
	assert.equal(json.format, 'notate-backup'); assert.equal(json.version, 1)
	assert.deepEqual(json.notes, db.NOTES.sort((x, y) => x.id - y.id))
	assert.deepEqual(json.notebooks, db.NOTEBOOKS)
	assert.deepEqual(json.notes.find((x) => x.id === 3).board, { x: 10, y: 20, r: 1, z: 3 })
	assert.deepEqual(b.errors, [])
})

for (const [what, item, ready] of [['editor', '#new-note-btn', '#edit-title'], ['Settings', '#context-item-settings', '#settings-modal']]) {
	test(`export controls are absent from the page ${what} and the page DOM`, async () => {
		await waitFor(config, 'seeded config')
		const { page, c } = await openFixture(b, fx)
		await openContextMenu(c)
		await c.click(item)
		await c.appear(ready)
		const root = 'chrome.dom.openOrClosedShadowRoot(document.querySelector("#content-script-entry-point"))'
		assert.equal(await page.eval(`[...(${root}).querySelectorAll('*')].filter((e) => /export/i.test(e.id) || (/export/i.test(e.textContent) && !e.children.length)).length`, 'content'), 0, 'nothing named Export in the page UI')
		assert.equal(await page.eval(`document.querySelectorAll('a[download], a[href^="blob:"]').length`), 0, 'no download link in the page DOM')
	})
}
