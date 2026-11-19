import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, startFixture, openFixture, openContextMenu, ui, waitFor, sleep, EXT_ID } from './helper.mjs'

const NEWTAB = `chrome-extension://${EXT_ID}/notate.html`
const PAGE_EDITOR = `chrome.dom.openOrClosedShadowRoot(document.querySelector("#content-script-entry-point")).querySelector('#input-text-display')`
let b, fx
beforeEach(async () => { fx = await startFixture(); b = await launch() })
afterEach(async () => { await b.close(); fx.close() })

const notes = async () => (await b.idb()).NOTATE_DB?.NOTES ?? []
const config = async () => (await b.idb()).USER_CONFIGURATION_DB?.USER_CONFIGURATION?.[0]
const stamp = new Date().toString()
const note = (id, title, content, origin = null) => ({ id, title, content, origin, color: { name: 'yellow', styles: { card: 'bg-yellow-200', top: 'bg-yellow-400' } }, created: stamp, modified: stamp })
const LINKS = '<div>See <span data-note-link="Beta">Beta</span> and <span data-note-link="Nowhere">Nowhere</span> and <span data-note-link="Other site">Other site</span> <span data-tag="recipe">#recipe</span></div>'

// A real mouse click on an element inside the editor.
async function clickIn(page, expr, world) {
	const at = () => page.eval(`(() => { const r = (${expr}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`, world)
	let prev = await at() // wait out the open animation of the modal or the editor
	for (let i = 0; i < 40; i++) { await sleep(150); const cur = await at(); if (cur.x === prev.x && cur.y === prev.y) break; prev = cur }
	await page.click(prev.x, prev.y)
}
const spanOf = (ed, attr, value) => `${ed}.querySelector('[${attr}="${value}"]')`
const faded = async (page, id) => Number(await page.eval(`getComputedStyle(document.querySelector('#note-card-${id}')).opacity`)) < 0.5

async function seedNewTab() {
	await b.openPage(NEWTAB)
	await waitFor(config, 'seeded config')
	await b.post('notate', 'NOTES', note(1, 'Alpha', LINKS))
	await b.post('notate', 'NOTES', note(2, 'Beta', '<div>second note, tagged #cooking</div>'))
	await b.post('notate', 'NOTES', note(3, 'Gamma', '<div>cake <span data-tag="recipe">#recipe</span></div>'))
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.click('#note-card-1')
	await waitFor(() => page.eval(`document.querySelector('#input-text-display')?.textContent.includes('Nowhere')`), 'editor filled')
	return { page, n }
}
const ED = `document.querySelector('#input-text-display')`

test('new tab: a link to an existing note opens it, a link to a missing note looks missing and does nothing', async () => {
	const { page, n } = await seedNewTab()
	const style = (v) => page.eval(`(() => { const s = getComputedStyle(${spanOf(ED, 'data-note-link', v)}); return s.borderBottomStyle + ' ' + s.cursor })()`)
	assert.equal(await style('Beta'), 'solid pointer')
	assert.equal(await style('Nowhere'), 'dashed default')
	await clickIn(page, spanOf(ED, 'data-note-link', 'Nowhere'))
	await sleep(500)
	assert.equal(await page.eval(`document.querySelector('#edit-note-title').value`), 'Alpha', 'a missing link opens nothing')
	await clickIn(page, spanOf(ED, 'data-note-link', 'Beta'))
	await waitFor(async () => (await page.eval(`document.querySelector('#edit-note-title')?.value`)) === 'Beta' && (await page.eval(`${ED}.textContent`)).includes('second note'), 'Beta opened')
	assert.deepEqual(b.errors, [])
})

test('new tab: following a link with unsaved changes asks first and the note stays open', async () => {
	const { page, n } = await seedNewTab()
	await page.eval(`${ED}.focus()`)
	await page.type('typed ')
	await clickIn(page, spanOf(ED, 'data-note-link', 'Beta'))
	await n.appear('#confirmation-modal')
	assert.equal(await page.eval(`document.querySelector('#edit-note-title').value`), 'Alpha')
	assert.match(await n.text(), /Leave this note\?/)
	await sleep(300)
	assert.deepEqual(b.errors, [])
})

test('new tab: a script that clicks a link or a tag does nothing', async () => {
	const { page } = await seedNewTab()
	await page.eval(`${spanOf(ED, 'data-note-link', 'Beta')}.click(); ${spanOf(ED, 'data-tag', 'recipe')}.click()`)
	await sleep(500)
	assert.equal(await page.eval(`document.querySelector('#edit-note-title').value`), 'Alpha')
	assert.equal(await page.eval(`document.querySelector('#searchInput')?.value`), '')
})

test('new tab: clicking a tag closes the note and searches for it, and search finds notes by tag', async () => {
	const { page, n } = await seedNewTab()
	await clickIn(page, spanOf(ED, 'data-tag', 'recipe'))
	await n.gone('#input-text-display')
	await waitFor(async () => (await page.eval(`document.querySelector('#searchInput').value`)) === '#recipe', 'search bar shows the tag')
	await waitFor(async () => (await faded(page, 1)) === false && (await faded(page, 3)) === false && (await faded(page, 2)) === true, 'notes with #recipe stay, the others fade')
	assert.deepEqual(b.errors, [])
})

// ---- in the page ----

async function openPageEditor(first = 1) {
	await b.serviceWorker()
	await waitFor(config, 'seeded config')
	await b.post('notate', 'NOTES', note(1, 'Here', LINKS, '127.0.0.1/'))
	await b.post('notate', 'NOTES', note(2, 'Beta', '<div>second note on this site</div>', '127.0.0.1/deep'))
	await b.post('notate', 'NOTES', note(3, 'Other site', '<div>private</div>', 'example.com/'))
	const { page, c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.appear('#context-item-page-notes')
	await c.click('#context-item-page-notes')
	await c.appear('#related-note-heading-1')
	await c.hover('#related-note-heading-1')
	await c.click('#related-note-heading-1')
	await c.appear('#edit-title')
	await waitFor(() => page.eval(`${PAGE_EDITOR}.textContent.includes('Nowhere')`, 'content'), 'page editor filled')
	return { page, c }
}
const pageTitle = (page) => page.eval(`chrome.dom.openOrClosedShadowRoot(document.querySelector("#content-script-entry-point")).querySelector('#edit-title').value`, 'content')

test('page editor: a link opens a note this page already has, and a link to another site\'s note stays inert', async () => {
	const { page } = await openPageEditor()
	const style = (v) => page.eval(`(() => { const s = getComputedStyle(${spanOf(PAGE_EDITOR, 'data-note-link', v)}); return s.borderBottomStyle })()`, 'content')
	assert.equal(await style('Beta'), 'solid')
	assert.equal(await style('Other site'), 'dashed', 'a note of another site is not resolved here')
	await clickIn(page, spanOf(PAGE_EDITOR, 'data-note-link', 'Other site'), 'content')
	await clickIn(page, spanOf(PAGE_EDITOR, 'data-note-link', 'Nowhere'), 'content')
	await page.eval(`${spanOf(PAGE_EDITOR, 'data-note-link', 'Beta')}.click()`, 'content') // not a real click
	await sleep(600)
	assert.equal(await pageTitle(page), 'Here')
	await clickIn(page, spanOf(PAGE_EDITOR, 'data-note-link', 'Beta'), 'content')
	await waitFor(async () => (await pageTitle(page)) === 'Beta', 'Beta opened in the page editor')
	assert.match(await page.eval(`${PAGE_EDITOR}.textContent`, 'content'), /second note on this site/)
	assert.deepEqual(b.errors, [])
})

test('page editor: a tag click does nothing', async () => {
	const { page } = await openPageEditor()
	await clickIn(page, spanOf(PAGE_EDITOR, 'data-tag', 'recipe'), 'content')
	await sleep(500)
	assert.equal(await pageTitle(page), 'Here')
	assert.equal(await page.eval(`location.href`), fx.url)
})
