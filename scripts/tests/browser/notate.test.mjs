import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, startFixture, openFixture, openContextMenu, ui, waitFor, sleep, EXT_ID } from './helper.mjs'

const NEWTAB = `chrome-extension://${EXT_ID}/notate.html`
let b, fx

beforeEach(async () => { fx = await startFixture(); b = await launch() })
afterEach(async () => { await b.close(); fx.close() })

const config = async () => (await b.idb()).USER_CONFIGURATION_DB?.USER_CONFIGURATION?.[0]
const notes = async () => (await b.idb()).NOTATE_DB?.NOTES ?? []
const notebooks = async () => (await b.idb()).NOTATE_DB?.NOTEBOOKS ?? []

// Create a note through the new tab page UI.
async function newTabNote(n, title, body) {
	const page = await b.openPage(NEWTAB)
	const n_ = ui(page)
	await n_.hover('#new-item-btn-container')
	await n_.click('button#new-note-button')
	await n_.fill('#edit-note-title', title)
	await n_.fill('#input-text-display', body)
	await n_.click('#save-btn')
	await waitFor(async () => (await notes()).some((x) => x.title === title), `note "${title}" in IndexedDB`)
	return { page, n: n_ }
}

test('first install: no errors, config seeded', async () => {
	await b.serviceWorker()
	const seeded = await waitFor(config, 'seeded config')
	assert.ok(seeded.Notate && seeded.WebContent, 'config has Notate and WebContent sections')
	assert.equal(seeded.WebContent.behavior.contextMenuPopup.value, 'true')
	// Load a content-script page and the new tab page so both contexts run their start-up code.
	await openFixture(b, fx)
	const tab = await b.openPage(NEWTAB)
	await ui(tab).appear('#page-title')
	await sleep(1500)
	// Probe: prove error capture is live, then drop the probe.
	const sw = await b.serviceWorker()
	await sw.eval(`console.error('probe')`)
	await waitFor(() => b.errors.some((e) => e.includes('probe')), 'error capture')
	b.errors.splice(b.errors.findIndex((e) => e.includes('probe')), 1)
	assert.deepEqual(b.errors, [])
	assert.ok(!b.errors.some((e) => e.includes('InvalidStateError')))
	assert.equal((await b.idb()).USER_CONFIGURATION_DB.USER_CONFIGURATION.length, 1, 'exactly one config record')
})

test('note created in the page editor is saved and shown on the new tab page', async () => {
	await waitFor(config, 'seeded config')
	const { c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#edit-title', 'Page note')
	await c.fill('#input-text-display', 'written on a web page')
	await c.click('#save-note-btn')
	const [saved] = await waitFor(async () => { const n = await notes(); return n.length && n }, 'note in IndexedDB')
	assert.equal(saved.title, 'Page note')
	assert.match(saved.content, /written on a web page/)
	const tab = ui(await b.openPage(NEWTAB))
	await waitFor(async () => (await tab.text()).includes('Page note'), 'note on new tab page')
	assert.deepEqual(b.errors, [])
})

test('note created on the new tab page is saved and survives a reload', async () => {
	const { page, n } = await newTabNote(null, 'Tab note', 'written on the new tab')
	const [saved] = await notes()
	assert.match(saved.content, /written on the new tab/)
	await page.send('Page.reload')
	await waitFor(async () => (await n.text()).includes('Tab note'), 'note after reload')
	assert.equal((await notes()).length, 1)
	assert.deepEqual(b.errors, [])
})

test('notebook with a note in it is saved', async () => {
	const { page, n } = await newTabNote(null, 'Booked note', 'goes in a notebook')
	const [note] = await notes()
	await n.hover('#new-item-btn-container')
	await n.click('#new-notebook-button')
	await n.fill('#notebook-title', 'My book')
	await n.fill('#notebook-description', 'About things')
	// Notes join a notebook by drag and drop: replay the drop with the note as the payload.
	await page.eval(`(() => {
		const dt = new DataTransfer(); dt.setData('text/plain', ${JSON.stringify(JSON.stringify(note))})
		document.querySelector('#note-card-collection').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
	})()`)
	await n.click('#save-notebook-button')
	const [book] = await waitFor(async () => { const n = await notebooks(); return n.length && n }, 'notebook in IndexedDB')
	assert.equal(book.title, 'My book')
	assert.equal(book.description, 'About things')
	assert.deepEqual(book.collection, [note.id])
	assert.deepEqual(b.errors, [])
})

test('a settings change persists', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	assert.equal((await waitFor(config)).Notate.search.searchNotes.value, 'true')
	await n.click('#settings-widget')
	await n.appear('#settings-modal')
	await n.click('#checkbox-option input') // first checkbox: Notate.search.searchNotes
	await n.click('#save-settings-button')
	await waitFor(async () => (await config()).Notate.search.searchNotes.value === 'false', 'saved setting')
	await page.send('Page.reload')
	await n.appear('#page-title')
	const saved = await config()
	assert.equal(saved.Notate.search.searchNotes.value, 'false')
	assert.equal(saved.WebContent.behavior.contextMenuPopup.value, 'true', 'other settings untouched')
	assert.equal((await b.idb()).USER_CONFIGURATION_DB.USER_CONFIGURATION.length, 1, 'still one config record')
	assert.deepEqual(b.errors, [])
})

async function dismiss(c, title) {
	await openContextMenu(c)
	await c.click('#context-dismiss-btn')
	await c.click(`button[title="${title}"]`)
	await c.gone('#context-menu-hover-region')
}

test('dismiss "Until Page Reload" hides the menu, and a reload brings it back', async () => {
	const { page, c } = await openFixture(b, fx)
	await dismiss(c, 'Until Page Reload')
	await page.send('Page.reload')
	await waitFor(() => page.eval(`!!document.querySelector('#content-script-entry-point')`), 'content script root')
	await c.appear('#context-menu-hover-region')
})

test('dismiss "For This Session" hides the menu, also after a reload', async () => {
	const { page, c } = await openFixture(b, fx)
	await dismiss(c, 'For This Session')
	assert.equal(await page.eval(`sessionStorage.getItem('context_menu_session_dismiss')`), 'true')
	await page.send('Page.reload')
	await waitFor(() => page.eval(`!!document.querySelector('#content-script-entry-point')`), 'content script root')
	await sleep(1500)
	assert.equal(await c.exists('#context-menu-hover-region'), false)
})

test('dismiss "For This Site" stores the site in config', { todo: 'dismissForSite() is imported but never called, so the site is not stored' }, async () => {
	const { c } = await openFixture(b, fx)
	await dismiss(c, 'For This Site')
	await waitFor(async () => (await config()).WebContent.dismissedSites?.includes('127.0.0.1'), 'site in config.WebContent.dismissedSites', 3000)
})
