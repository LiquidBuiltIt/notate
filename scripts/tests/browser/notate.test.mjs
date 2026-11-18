import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, startFixture, openFixture, openContextMenu, ui, waitFor, sleep, EXT_ID, CONTENT_ROOT } from './helper.mjs'

const NEWTAB = `chrome-extension://${EXT_ID}/notate.html`
let b, fx

beforeEach(async () => { fx = await startFixture(); b = await launch() })
afterEach(async () => { await b.close(); fx.close() })

const config = async () => (await b.idb()).USER_CONFIGURATION_DB?.USER_CONFIGURATION?.[0]
const notes = async () => (await b.idb()).NOTATE_DB?.NOTES ?? []
const notebooks = async () => (await b.idb()).NOTATE_DB?.NOTEBOOKS ?? []
const pressKey = async (page, key, extra = {}) => {
	const text = key === 'Enter' ? '\r' : undefined
	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, text, ...extra })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, ...extra })
}

// Create a note through the new tab page UI.
async function newTabNote(n, title, body) {
	const page = await b.openPage(NEWTAB)
	const n_ = ui(page)
	await n_.hover('#search-bar-tab')
	await n_.click('#new-note-button')
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
	await n.fill('#searchInput', '/notebook')
	await pressKey(page, 'Enter') // completes the command
	await pressKey(page, 'Enter') // runs it: no title opens the blank notebook modal
	await n.appear('#notebook-title')
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

test('deleting a notebook keeps its notes, and the warning says so', async () => {
	await b.post('notate', 'NOTES', { id: 1, title: 'Kept note', content: 'stays', origin: null, color: { name: 'yellow', styles: { card: 'bg-yellow-200', top: 'bg-yellow-400' } }, created: new Date().toString(), modified: new Date().toString() })
	await b.post('notate', 'NOTEBOOKS', { id: 1, title: 'Doomed book', description: 'x', collection: [1], created: new Date().toString(), modified: new Date().toString() })
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.click('#notebook-card-1')
	await n.click('#delete-notebook-btn')
	await n.appear('#confirmation-modal')
	assert.match(await page.eval(`document.querySelector('#message').textContent`), /notes stay/)
	await n.click('#action-btn')
	await waitFor(async () => (await notebooks()).length === 0, 'notebook deleted')
	await n.gone('#confirmation-modal')
	assert.deepEqual((await notes()).map((x) => x.title), ['Kept note'])
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

test('dragging the seal snaps it to the nearest corner, does not open the menu, and the corner survives a reload', async () => {
	await waitFor(config, 'seeded config')
	const { page, c } = await openFixture(b, fx)
	await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
	const region = () => page.eval(`(() => { const r = (${CONTENT_ROOT}).querySelector('#context-menu-hover-region').getBoundingClientRect(); return [r.top, r.left] })()`, 'content')
	await c.hover('#context-menu-hover-strip')
	const s = await c.center('#context-menu-btn')
	await page.mouse('mousePressed', s.x, s.y, { buttons: 1 })
	for (let i = 1; i <= 5; i++) await page.mouse('mouseMoved', s.x - (s.x - 100) * i / 5, s.y - (s.y - 150) * i / 5, { buttons: 1 })
	await page.mouse('mouseReleased', 100, 150, { buttons: 0 })
	await waitFor(async () => (await region()).join() === '32,0', 'seal in the top-left corner')
	assert.equal(await page.eval(`(${CONTENT_ROOT}).querySelector('#context-menu').className.includes('pointer-events-none')`, 'content'), true, 'menu stays closed after a drag')
	await page.send('Page.reload')
	await waitFor(() => page.eval(`!!document.querySelector('#content-script-entry-point')`), 'content script root')
	await c.appear('#context-menu-btn')
	await waitFor(async () => (await region()).join() === '32,0', 'seal still in the top-left corner after a reload')
	await openContextMenu(c)
	await waitFor(async () => !(await page.eval(`(${CONTENT_ROOT}).querySelector('#context-menu').className.includes('pointer-events-none')`, 'content')), 'a click still opens the menu')
	assert.deepEqual(b.errors, [])
})

test('the seal stays on screen after a drop inside its corner zone, and when it gets keyboard focus', async () => {
	await waitFor(config, 'seeded config')
	const { page, c } = await openFixture(b, fx)
	await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
	const onScreen = () => page.eval(`(() => { const r = (${CONTENT_ROOT}).querySelector('#context-menu-btn').getBoundingClientRect(); return r.bottom <= 900 && r.right <= 1440 })()`, 'content')
	// Keyboard focus: the seal slides in from off-screen.
	await page.send('Page.bringToFront')
	for (let i = 0; i < 15 && !(await page.eval(`(${CONTENT_ROOT}).activeElement?.id === 'context-menu-btn'`, 'content')); i++) {
		await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
		await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
		await sleep(100)
	}
	await waitFor(onScreen, 'the focused seal on screen')
	// Drop away from the seal's final spot but inside the corner zone: the seal still shows.
	await c.hover('#context-menu-hover-strip')
	const s = await c.center('#context-menu-btn')
	await page.mouse('mousePressed', s.x, s.y, { buttons: 1 })
	for (let i = 1; i <= 5; i++) await page.mouse('mouseMoved', s.x - (s.x - 100) * i / 5, s.y - (s.y - 140) * i / 5, { buttons: 1 })
	await page.mouse('mouseReleased', 100, 140, { buttons: 0 })
	await sleep(600)
	assert.equal(await page.eval(`(${CONTENT_ROOT}).querySelector('#context-menu-btn').getBoundingClientRect().top >= 0`, 'content'), true, 'seal is visible after the drop')
	assert.deepEqual(b.errors, [])
})

test('the hidden seal lets clicks through to the page, and Arrow keys move the focused seal between corners', async () => {
	await waitFor(config, 'seeded config')
	const { page, c } = await openFixture(b, fx)
	await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
	const hitsSeal = (x, y) => page.eval(`document.elementFromPoint(${x}, ${y})?.id === 'content-script-entry-point'`)
	assert.equal(await hitsSeal(1440 - 56, 900 - 56), false, 'a point in the old hover zone reaches the page')
	assert.equal(await hitsSeal(1440 - 56, 900 - 10), true, 'the edge strip still takes the hover')
	const key = async (k) => {
		await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: { Tab: 9, ArrowUp: 38, ArrowLeft: 37 }[k] })
		await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: { Tab: 9, ArrowUp: 38, ArrowLeft: 37 }[k] })
		await sleep(100)
	}
	const region = () => page.eval(`(() => { const r = (${CONTENT_ROOT}).querySelector('#context-menu-hover-region').getBoundingClientRect(); return [r.top, r.left] })()`, 'content')
	await page.send('Page.bringToFront')
	for (let i = 0; i < 15 && !(await page.eval(`(${CONTENT_ROOT}).activeElement?.id === 'context-menu-btn'`, 'content')); i++) await key('Tab')
	await key('ArrowUp')
	await waitFor(async () => (await region()).join() === `32,${1440 - 112}`, 'seal in the top-right corner')
	await key('ArrowLeft')
	await waitFor(async () => (await region()).join() === '32,0', 'seal in the top-left corner')
	assert.equal(await page.eval(`(${CONTENT_ROOT}).activeElement?.id === 'context-menu-btn'`, 'content'), true, 'focus stays on the seal')
	assert.equal(await page.eval(`(${CONTENT_ROOT}).querySelector('#context-menu').className.includes('pointer-events-none')`, 'content'), true, 'menu stays closed')
	assert.deepEqual(b.errors, [])
})

test('dismiss "For This Site" hides the menu in new tabs on that site, and Settings can show it again', async () => {
	const { c } = await openFixture(b, fx)
	await dismiss(c, 'For This Site')
	await waitFor(async () => (await config()).WebContent.dismissedSites?.includes('127.0.0.1'), 'site in config.WebContent.dismissedSites', 3000)

	const other = await b.openPage(fx.url) // a new tab, so no session dismissal applies
	await waitFor(() => other.eval(`!!document.querySelector('#content-script-entry-point')`), 'content script root')
	await sleep(1500)
	assert.equal(await ui(other, CONTENT_ROOT, 'content').exists('#context-menu-hover-region'), false, 'hidden in a new tab on the same site')

	const tab = await b.openPage(NEWTAB)
	const n = ui(tab)
	await n.click('#settings-widget')
	await n.appear('#show-hidden-sites')
	assert.match(await tab.eval(`document.querySelector('#hidden-sites').textContent`), /hidden on 1 site\./)
	await tab.eval(`document.querySelector('#show-hidden-sites').scrollIntoView({ block: 'center' })`) // the row sits below the fold of the settings pane
	await n.click('#show-hidden-sites')
	await n.gone('#show-hidden-sites')
	await n.click('#save-settings-button')
	await waitFor(async () => (await config()).WebContent.dismissedSites?.length === 0, 'dismissedSites cleared')
	assert.equal((await config()).WebContent.behavior.contextMenuPopup.value, 'true', 'other settings untouched')

	const again = await openFixture(b, fx)
	await again.c.appear('#context-menu-hover-region')
	assert.deepEqual(b.errors, [])
})

// ---- Config writes change only what the writer changed ----

// Open Settings on a new tab page and wait until its config is loaded.
async function openSettings() {
	const tab = await b.openPage(NEWTAB)
	const n = ui(tab)
	await n.click('#settings-widget')
	await n.appear('#checkbox-option input') // first checkbox: Notate.search.searchNotes
	return n
}
async function toggleSearchNotesAndSave(n) {
	await n.click('#checkbox-option input')
	await n.click('#save-settings-button')
	await waitFor(async () => (await config()).Notate.search.searchNotes.value === 'false', 'searchNotes saved')
}

test('"For This Site" on a page opened before a settings change keeps that change', async () => {
	await waitFor(config, 'seeded config')
	const { c } = await openFixture(b, fx) // loads the config as it is now
	await toggleSearchNotesAndSave(await openSettings())
	await dismiss(c, 'For This Site')
	await waitFor(async () => (await config()).WebContent.dismissedSites?.includes('127.0.0.1'), 'site stored', 3000)
	assert.equal((await config()).Notate.search.searchNotes.value, 'false', 'the settings change survived')
})

test('Settings Save keeps a site dismissed after Settings opened', async () => {
	await waitFor(config, 'seeded config')
	const n = await openSettings() // loads the config as it is now
	const { c } = await openFixture(b, fx)
	await dismiss(c, 'For This Site')
	await waitFor(async () => (await config()).WebContent.dismissedSites?.includes('127.0.0.1'), 'site stored', 3000)
	await toggleSearchNotesAndSave(n)
	assert.deepEqual((await config()).WebContent.dismissedSites, ['127.0.0.1'], 'the dismissed site survived the save')
})

test('two pages dismissing different sites at the same time both get stored', async () => {
	await waitFor(config, 'seeded config')
	const one = await openFixture(b, fx)
	const two = await openFixture(b, { url: fx.url.replace('127.0.0.1', 'localhost') })
	await Promise.all([dismiss(one.c, 'For This Site'), dismiss(two.c, 'For This Site')])
	await waitFor(async () => ((await config()).WebContent.dismissedSites ?? []).length === 2, 'both sites stored', 3000)
	assert.deepEqual([...(await config()).WebContent.dismissedSites].sort(), ['127.0.0.1', 'localhost'])
})

// ---- Security hardening ----

test('the content script shadow root is closed to page scripts, and the UI still works', async () => {
	const { page, c } = await openFixture(b, fx)
	assert.equal(await page.eval(`document.getElementById('content-script-entry-point').shadowRoot`), null)
	assert.equal(await page.eval(`document.getElementById('content-script-entry-point').shadowRoot === null`), true)
	await openContextMenu(c)
	await c.appear('#new-note-btn')
	assert.deepEqual(b.errors, [])
})

test('"Select All" in the page editor still selects the note text', async () => {
	const { page, c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#input-text-display', 'select me please')
	const { x, y } = await c.center('#input-text-display')
	await page.rightClick(x, y)
	await c.click('#selectAll')
	assert.match(await page.eval(`window.getSelection().toString()`, 'content'), /select me please/)
	assert.deepEqual(b.errors, [])
})

test('scripted clicks cannot save a note from the page editor', async () => {
	const { c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#edit-title', 'Scripted')
	await c.fill('#input-text-display', 'body')
	await c.scriptedClick('#save-note-btn')
	await sleep(1000)
	assert.equal((await notes()).length, 0, 'scripted click saved nothing')
	await c.click('#save-note-btn')
	await waitFor(async () => (await notes()).length === 1, 'real click saves')
})

test('the menu lists this site\'s notes in a picker, page notes first, and opens one on a real click', async () => {
	await b.openPage(NEWTAB)
	const { c: before } = await openFixture(b, fx)
	await openContextMenu(before)
	await before.appear('#new-note-btn')
	assert.equal(await before.exists('#context-item-page-notes'), false, 'no tag while the site has no notes')

	await plantNote('on this page', { id: 1, title: 'Here', origin: '127.0.0.1/' })
	await plantNote('elsewhere', { id: 2, title: 'There', origin: '127.0.0.1/other' })
	await plantNote('another site', { id: 3, title: 'Away', origin: 'example.com/' })
	const { c, page } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.appear('#context-item-page-notes')
	assert.match(await c.text(), /Notes From This Site \(2\)/)
	await c.click('#context-item-page-notes')
	await c.appear('#page-notes-modal #related-note-title')
	const titles = await page.eval(`[...chrome.dom.openOrClosedShadowRoot(document.querySelector('#content-script-entry-point')).querySelectorAll('#page-notes-list [id="related-note-title"]')].map((e) => e.textContent)`, 'content')
	assert.deepEqual(titles, ['Here', 'There'], 'page note first, then the site note, never another site')

	await c.scriptedClick('#related-note-heading-1')
	await sleep(800)
	assert.equal(await c.exists('#edit-title'), false, 'scripted click did not open the note')
	await c.hover('#related-note-heading-1')
	await c.click('#related-note-heading-1')
	await c.appear('#edit-title')
	await c.gone('#page-notes-modal')

	// Add to Notebook drags from the same list.
	const { c: c2 } = await openFixture(b, fx)
	await openContextMenu(c2)
	await c2.click('#context-item-add-to-notebook')
	await c2.appear('#page-notes-source #related-note-heading-2')
	assert.deepEqual(b.errors, [])
})

// Notes whose content is attacker-shaped HTML must show as inert text.
async function plantNote(content, extra = {}) {
	await b.serviceWorker()
	await waitFor(config, 'seeded config')
	const note = { id: 1, title: 'Planted', content, origin: 'example.com/', color: { name: 'yellow', styles: { card: 'bg-yellow-200', top: 'bg-yellow-400' } }, ...extra }
	await b.post('notate', 'NOTES', note)
	return note
}

for (const [name, content] of [
	['raw html', '<img src=x onerror="window.__pwn=1">hello <b>bold</b>'],
	['escaped html', '&lt;img src=x onerror="window.__pwn=1"&gt;hello'],
]) {
	test(`note previews render ${name} as inert text on the new tab page and in the notebook modal`, async () => {
		await b.openPage(NEWTAB) // creates the databases
		await waitFor(config, 'seeded config')
		await plantNote(content)
		await plantNote(content, { id: 2 }) // a loose note: filed notes show only inside their volume
		await b.post('notate', 'NOTEBOOKS', { id: 1, title: 'Book', description: 'd', collection: [1], created: new Date().toISOString(), modified: new Date().toISOString() })
		const page = await b.openPage(NEWTAB)
		const n = ui(page)
		await n.appear('[id$="-content"]')
		await sleep(500)
		const inert = () => page.eval(`({ imgs: document.querySelectorAll('[id$="-content"] img').length, pwn: window.__pwn ?? null, text: [...document.querySelectorAll('[id$="-content"]')].map((e) => e.textContent).join('|') })`)
		let r = await inert()
		assert.equal(r.imgs, 0, 'no element created in a note card')
		assert.equal(r.pwn, null)
		assert.match(r.text, /hello/)
		assert.doesNotMatch(r.text, /boldbold/, 'formatted text is not repeated')
		assert.equal((r.text.match(/hello/g) || []).length, (await page.eval(`document.querySelectorAll('[id$="-content"]').length`)), 'formatted text is not repeated')
		await n.click('#notebook-card-container')
		await n.appear('#notebook-modal')
		await sleep(500)
		r = await inert()
		assert.equal(r.imgs, 0, 'no element created in the notebook modal')
		assert.equal(r.pwn, null)
	})
}

async function openPlantedNote(content) {
	await b.openPage(NEWTAB)
	await waitFor(config, 'seeded config')
	await plantNote(content)
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.click('#note-card-1')
	// The editor is filled from the note after it mounts: typing earlier is wiped out by that fill.
	await waitFor(() => page.eval(`document.querySelector('#input-text-display')?.textContent.trim().length > 0`), 'editor filled with the note')
	await n.fill('#input-text-display', 'typed ')
	await n.click('#save-btn')
	const saved = await waitFor(async () => (await notes()).find((x) => x.id === 1 && x.content.includes('typed')), 'saved edit')
	return saved.content
}
const parse = (html) => b.reader().then((r) => r.eval(`(() => {
	const d = new DOMParser().parseFromString(${JSON.stringify(html)}, 'text/html')
	return { anchors: d.querySelectorAll('a').length, nested: d.querySelectorAll('a a').length, hrefs: [...d.querySelectorAll('a')].map((a) => a.getAttribute('href')),
		onAttrs: [...d.querySelectorAll('*')].flatMap((e) => e.getAttributeNames()).filter((a) => a.startsWith('on')) }
})()`))

test('re-saving a note does not wrap a link that is already an anchor', async () => {
	const content = await openPlantedNote('<a href="http://example.com/x?a=1&amp;b=2">http://example.com/x?a=1&amp;b=2</a> and http://other.example/y')
	const r = await parse(content)
	assert.equal(r.anchors, 2, content)
	assert.equal(r.nested, 0, content)
	assert.deepEqual(r.hrefs, ['http://example.com/x?a=1&b=2', 'http://other.example/y'])
})

test('a quote in a typed URL cannot break out of href', async () => {
	const content = await openPlantedNote('http://example.com/"onmouseover="alert(1) end')
	const r = await parse(content)
	assert.deepEqual(r.onAttrs, [], content)
	assert.ok(r.hrefs.some((h) => h.includes('"onmouseover="')), content)
})

// ---- Page-initiated editing ----

const EDITOR = `${'chrome.dom.openOrClosedShadowRoot(document.querySelector("#content-script-entry-point"))'}.querySelector('#input-text-display')`
async function openPageEditor() {
	const { page, c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#edit-title', 'Injected')
	await c.fill('#input-text-display', 'before ')
	return { page, c }
}

const ROOT_IMG = '<img src=x onerror="window.__root=this.getRootNode()">injected'
const ROOT_IFRAME = '<iframe src="javascript:window.top.__root=frameElement.getRootNode()"></iframe>'
const MARKUP = /<img[^>]*src="(?!data:image)|<iframe|onerror|javascript:/
const editorHtml = (page) => page.eval(`${EDITOR}.innerHTML`, 'content')
// Real key presses: one keydown with text per character, so every key fires its own input event.
async function pressKeys(page, text) {
	for (const ch of text) {
		const key = { key: ch, text: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0) }
		await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key })
		await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key })
	}
}
async function assertHeld(page, c, what) {
	await sleep(700) // an onerror handler or a javascript: frame would have run by now
	assert.equal(await page.eval(`window.__root instanceof ShadowRoot`), false, `${what}: the page script did not reach the closed shadow root`)
	assert.doesNotMatch(await editorHtml(page), MARKUP, what)
	await c.click('#save-note-btn')
	const [saved] = await waitFor(async () => { const n = await notes(); return n.length && n }, 'note in IndexedDB')
	assert.doesNotMatch(saved.content, MARKUP, `${what}: saved note`)
	assert.deepEqual(b.errors, [])
	return saved
}

test('a page capture listener that stops input events cannot keep markup in the editor, and normal editing still works', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`window.__stop = (e) => e.stopImmediatePropagation(); window.addEventListener('input', window.__stop, true)`)
	await page.eval(`document.execCommand('insertHTML', false, ${JSON.stringify(ROOT_IFRAME + ROOT_IMG)})`)
	await page.eval(`document.execCommand('insertImage', false, 'data:image/gif;base64,R0lGODlhAQABAAAAACw=')`)
	await sleep(700)
	assert.doesNotMatch(await editorHtml(page), MARKUP)
	await page.eval(`window.removeEventListener('input', window.__stop, true)`)
	// Real typing, paste and bold keep working afterwards.
	await page.type('typed ')
	await page.eval(`(() => {
		const dt = new DataTransfer(); dt.setData('text/plain', 'pasted ')
		${EDITOR}.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
	})()`, 'content')
	await page.eval(`document.execCommand('selectAll')`, 'content')
	await c.click('#bold-btn')
	const saved = await assertHeld(page, c, 'capture-stop')
	assert.match(saved.content.replace(/<[^>]*>|&nbsp;/g, ' '), /before\s+injected\s*typed pasted/)
	assert.match(saved.content, /<b[ >]/)
})

test('a page script cannot bring its markup back with undo and redo', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`document.execCommand('insertHTML', false, ${JSON.stringify(ROOT_IMG + ROOT_IFRAME)})`)
	await sleep(300)
	await page.eval(`document.execCommand('undo')`)
	await sleep(300)
	await page.eval(`document.execCommand('redo')`)
	await page.eval(`document.execCommand('insertHTML', false, ${JSON.stringify(ROOT_IMG)}); document.execCommand('undo'); document.execCommand('redo')`)
	await assertHeld(page, c, 'undo/redo')
})

test('a page script cannot save a javascript: link in the editor', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`document.execCommand('selectAll')`, 'content')
	await page.eval(`document.execCommand('createLink', false, 'javascript:window.__root=1')`)
	await assertHeld(page, c, 'createLink')
})

test('a page script that inserts markup on every input event cannot drop or reorder typed keys', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`(() => { let busy = false
		window.addEventListener('input', () => { if (busy) return; busy = true
			try { document.execCommand('insertHTML', false, ${JSON.stringify(ROOT_IMG + ROOT_IFRAME)}) } finally { busy = false } }, true) })()`)
	await pressKeys(page, 'abcdef')
	await sleep(500)
	const saved = await assertHeld(page, c, 'nested insert')
	assert.match(saved.content.replace(/<[^>]*>/g, '').replace(/injected/g, ''), /before abcdef/, saved.content)
})

test('real Backspace deletes a character in the page editor', async () => {
	const { page, c } = await openPageEditor()
	await page.type('xyz')
	const key = { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }
	await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key })
	await waitFor(async () => (await editorHtml(page)).includes('before xy') && !(await editorHtml(page)).includes('xyz'), 'one character deleted')
	await c.click('#save-note-btn')
	const [saved] = await waitFor(async () => { const n = await notes(); return n.length && n }, 'note in IndexedDB')
	assert.match(saved.content, /before xy(?!z)/)
	assert.deepEqual(b.errors, [])
})

test('the font size select changes the size of the selected text', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`document.execCommand('selectAll')`, 'content')
	const select = '#font-size-controls select'
	await page.eval(`chrome.dom.openOrClosedShadowRoot(document.querySelector('#content-script-entry-point')).querySelector(${JSON.stringify(select)}).focus()`, 'content')
	const key = { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 } // the select starts at 3 (Normal)
	await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key })
	await waitFor(async () => /<font [^>]*size="4"[^>]*>before/.test(await editorHtml(page)), 'text resized to 4')
	await c.click('#save-note-btn')
	const [saved] = await waitFor(async () => { const n = await notes(); return n.length && n }, 'note in IndexedDB')
	assert.match(saved.content, /<font [^>]*size="4"[^>]*>before/)
	assert.deepEqual(b.errors, [])
})

test('"Insert Image" from the editor context menu still inserts the picked image', async () => {
	const { page, c } = await openPageEditor()
	const gif = join(tmpdir(), 'notate-test.gif')
	writeFileSync(gif, Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'))
	await page.send('Page.setInterceptFileChooserDialog', { enabled: true })
	const opened = new Promise((res) => b.cdp.on((m) => { if (m.method === 'Page.fileChooserOpened') res(m.params) }))
	const { x, y } = await c.center('#input-text-display')
	await page.rightClick(x, y)
	await c.click('#insertImg')
	await page.send('DOM.setFileInputFiles', { files: [gif], backendNodeId: (await opened).backendNodeId })
	await waitFor(() => page.eval(`!!${EDITOR}.querySelector('img[src^="data:image/gif"]')`, 'content'), 'picked image in the editor')
})

test('scripted clicks cannot close the page editor window', async () => {
	const { page, c } = await openPageEditor()
	const closeBtn = '#editor-window-ctrl-center > button:last-child'
	await page.eval(`(() => { const el = chrome.dom.openOrClosedShadowRoot(document.querySelector('#content-script-entry-point')).querySelector(${JSON.stringify(closeBtn)}); el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })()`, 'content')
	await sleep(700)
	assert.equal(await c.exists('#edit-title'), true, 'scripted click did not close the editor')
	await c.click(closeBtn)
	await c.gone('#edit-title')
})

test('scripted clicks cannot save the add-to-notebook modal', async () => {
	await b.openPage(NEWTAB)
	await waitFor(config, 'seeded config')
	const note = await plantNote('body')
	await b.post('notate', 'NOTEBOOKS', { id: 1, title: 'Book', description: 'd', collection: [], created: new Date().toISOString(), modified: new Date().toISOString() })
	const { c, page } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#context-item-add-to-notebook')
	await c.appear('#notebook-card-1')
	await page.eval(`(() => {
		const dt = new DataTransfer(); dt.setData('text/plain', ${JSON.stringify(JSON.stringify(note))})
		${'chrome.dom.openOrClosedShadowRoot(document.querySelector("#content-script-entry-point"))'}.querySelector('#notebook-card-1').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
	})()`, 'content')
	await c.scriptedClick('#add-to-notebook-bottombar #save-btn')
	await sleep(1000)
	assert.deepEqual((await notebooks())[0].collection, [], 'scripted click saved nothing')
	await c.click('#add-to-notebook-bottombar #save-btn')
	await waitFor(async () => (await notebooks())[0].collection.length === 1, 'real click saves')
})

// ---- Stored note HTML is sanitized when the editor opens a note ----

async function openPlantedEditor(content, beforeOpen = '0') {
	await b.openPage(NEWTAB)
	await waitFor(config, 'seeded config')
	await plantNote(content)
	const page = await b.openPage(NEWTAB)
	await ui(page).appear('#note-card-1')
	await page.eval(beforeOpen)
	await ui(page).click('#note-card-1')
	await waitFor(() => page.eval(`document.querySelector('#input-text-display')?.childNodes.length > 0`), 'editor filled with the note')
	return page
}
const editorState = (page) => page.eval(`(() => {
	const ed = document.querySelector('#input-text-display')
	const all = [...ed.querySelectorAll('*')]
	return { html: ed.innerHTML, text: ed.textContent,
		tags: all.map((e) => e.localName), attrs: all.flatMap((e) => e.getAttributeNames().map((a) => e.localName + '.' + a)),
		hrefs: [...ed.querySelectorAll('a')].map((a) => a.getAttribute('href')),
		srcs: [...ed.querySelectorAll('img')].map((i) => i.getAttribute('src')),
		pwn: window.__pwn ?? null, beacons: performance.getEntriesByType('resource').filter((r) => r.name.includes('/beacon')).length }
})()`)

test('a stored note is rebuilt from an allowlist when the editor opens it', async () => {
	const page = await openPlantedEditor('<p>keep</p><img src="x" onerror="window.__pwn=1"><img src="http://127.0.0.1:1/beacon"><iframe src="http://127.0.0.1:1/beacon">iframetext</iframe>'
		+ '<style>body{display:none}</style><svg><a href="javascript:1">svgtext</a></svg><script>window.__pwn=2</script><a href="javascript:alert(1)" onclick="x">js link</a><a href="ok.html">rel</a>'
		+ '<a href="https://example.com/p?a=1&amp;b=2" target="_blank">good link</a><span style="background:url(http://127.0.0.1:1/beacon);color:red;width:50%" onclick="1">styled</span>'
		+ '<blah>unwrapped</blah><template><b>tpl</b></template><form action="http://evil"><input name="x">formtext</form><font size="9" face="x">big</font><font size="5">ok</font>')
	await sleep(500)
	const s = await editorState(page)
	for (const gone of ['iframe', 'style', 'script', 'svg', 'form', 'input', 'template', 'blah']) assert.ok(!s.tags.includes(gone), `${gone} removed: ${s.html}`)
	assert.deepEqual(s.attrs.filter((a) => /\.on/.test(a)), [], s.html)
	assert.ok(s.srcs.every((v) => v === null), 'no remote or non-data image source')
	assert.deepEqual(s.hrefs, [null, null, 'https://example.com/p?a=1&b=2'], s.html)
	assert.doesNotMatch(s.html, /url\(|background/, s.html)
	assert.match(s.html, /width: 50%/)
	assert.doesNotMatch(s.html, /size="9"|face=|target=/)
	assert.match(s.html, /size="5"/)
	for (const t of ['keep', 'js link', 'rel', 'good link', 'styled', 'unwrapped', 'big']) assert.ok(s.text.includes(t), `kept text ${t}`)
	for (const t of ['iframetext', 'svgtext', 'tpl', 'formtext', 'body{display']) assert.ok(!s.text.includes(t), `dropped content ${t}`)
	assert.equal(s.pwn, null)
	assert.equal(s.beacons, 0, 'nothing was requested')
})

test('DOM clobbering names in a stored note do not stop the sanitizer', async () => {
	const page = await openPlantedEditor('<img name="body"><form id="f"><input name="attributes"><input name="childNodes"><input name="localName"><input name="nodeType">formtext</form>'
		+ '<iframe name="body"></iframe><embed name="childNodes"><div><b>bold</b> after</div>')
	const s = await editorState(page)
	assert.ok(!s.tags.includes('form') && !s.tags.includes('input'), s.html)
	assert.ok(s.tags.includes('b') && s.text.includes('bold after'), s.html)
	assert.ok(!s.text.includes('<'), 'not rendered as the plain text fallback')
	assert.ok(!s.text.includes('formtext'))
})

test('if the sanitizer fails, the editor shows the raw note as plain text and keeps working', async () => {
	const raw = '<b>FALLBACKMARK</b> and <i>text</i>'
	const page = await openPlantedEditor(raw, `(() => { const p = DOMParser.prototype.parseFromString; DOMParser.prototype.parseFromString = function (h, t) { if (String(h).includes('FALLBACKMARK')) throw new Error('forced'); return p.call(this, h, t) } })()`)
	const s = await editorState(page)
	assert.equal(s.text.trim(), raw)
	assert.equal(s.tags.length, 0, 'plain text, no elements')
	assert.deepEqual(b.errors, [], 'the error did not escape')
	assert.equal(await ui(page).exists('#save-btn'), true, 'the app is still mounted')
})

test('bold, italic, underline, strike, size, alignment, links and sized images survive save and reopen', async () => {
	const gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
	const content = await openPlantedNote('<b>b1</b><i>i1</i><u>u1</u><strike>s1</strike><font size="5">big</font>'
		+ '<div style="text-align: center;">mid</div><div style="text-align: right;">right</div><a href="https://example.com/x">link</a>'
		+ `<img id="img-1-abc" src="${gif}" draggable="true" data-natural-width="40" data-natural-height="30" style="max-width: 100%; width: 40px; height: 30px;">`)
	const r = await b.reader().then((rd) => rd.eval(`(() => {
		const d = new DOMParser().parseFromString(${JSON.stringify(content)}, 'text/html')
		const q = (s) => d.querySelector(s)
		const img = q('img')
		return { b: !!q('b'), i: !!q('i'), u: !!q('u'), strike: !!q('strike'), size: q('font')?.getAttribute('size'),
			center: q('div[style*="text-align: center"]')?.textContent, right: q('div[style*="text-align: right"]')?.textContent, href: q('a')?.getAttribute('href'),
			img: img && { id: img.id, src: img.getAttribute('src'), drag: img.getAttribute('draggable'), w: img.getAttribute('data-natural-width'), h: img.getAttribute('data-natural-height'), width: img.style.width, height: img.style.height, max: img.style.maxWidth } }
	})()`))
	assert.deepEqual(r, { b: true, i: true, u: true, strike: true, size: '5', center: 'mid', right: 'right', href: 'https://example.com/x',
		img: { id: 'img-1-abc', src: gif, drag: 'true', w: '40', h: '30', width: '40px', height: '30px', max: '100%' } }, content)
})

// Handlers on inserted markup. Chromium runs them in a later task, after the editor's observer has removed the node; this test holds that.
test('handlers on markup inserted by a page script cannot reach the closed shadow root', async () => {
	const { page, c } = await openPageEditor()
	const grab = 'window.__root = this.getRootNode()'
	const payloads = {
		iframeNoSrc: `<iframe onload="${grab}"></iframe>`,
		iframeBlank: `<iframe src="about:blank" onload="${grab}"></iframe>`,
		img: `<img src=x onerror="${grab}">`,
		video: `<video src=x onerror="${grab}" onloadstart="${grab}"></video>`,
		audio: `<audio src=x onerror="${grab}" onloadstart="${grab}"></audio>`,
		details: `<details open ontoggle="${grab}"><summary>s</summary></details>`,
	}
	// Control: the same payloads do run when the page edits its own contenteditable.
	await page.eval(`(() => { const d = document.createElement('div'); d.contentEditable = true; document.body.append(d); d.focus()
		document.execCommand('insertHTML', false, ${JSON.stringify(payloads.iframeNoSrc.replace(grab, 'window.__ctrl = this.getRootNode() === document'))}) })()`)
	await waitFor(() => page.eval('window.__ctrl === true'), 'control payload to run')
	await c.fill('#input-text-display', 'x')
	const reached = {}
	for (const [name, html] of Object.entries(payloads)) {
		assert.equal(await page.eval(`window.__root instanceof ShadowRoot`), false, `${name}: the previous payload did not reach the root`)
		await page.eval(`window.__root = null; document.execCommand('insertHTML', false, ${JSON.stringify(html)})`)
		await sleep(400)
		reached[name] = await page.eval(`window.__root instanceof ShadowRoot`)
	}
	assert.deepEqual(reached, Object.fromEntries(Object.keys(payloads).map((k) => [k, false])))
	await assertHeld(page, c, 'handlers')
})

// ---- Guard failure modes: overflow, state desync, is= ----

// What the page stored for a Save, as the content script's world sees it.
async function saveNow(c) {
	await c.click('#save-note-btn')
	const [saved] = await waitFor(async () => { const n = await notes(); return n.length && n }, 'note in IndexedDB')
	return saved
}

test('a huge inserted subtree does not stop the guard: the markup behind it is removed and later inserts are cleaned too', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`document.execCommand('insertHTML', false, '<section>' + '<br>'.repeat(200000) + '</section>${ROOT_IMG}')`)
	await waitFor(async () => !(await page.eval(`!!${EDITOR}.querySelector('section, img[onerror]')`, 'content')), 'huge insert cleaned') // a 5 MB innerHTML is not sent over CDP
	await page.eval(`for (const br of ${EDITOR}.querySelectorAll('br')) br.remove()`, 'content') // keep the saved note small
	await sleep(700)
	await page.eval(`window.__root = null; document.execCommand('insertHTML', false, ${JSON.stringify(ROOT_IFRAME + ROOT_IMG)})`)
	await sleep(700)
	const saved = await assertHeld(page, c, 'huge insert')
	assert.match(saved.content, /before/)
	assert.match(saved.content, /injected/)
})

test('if the guard throws, it removes what the failing change added, keeps the rest, and works on the next change', async () => {
	const { page, c } = await openPageEditor()
	const inEditor = (code) => page.eval(`(() => { const ed = ${EDITOR}; ${code} })()`, 'content')
	// Content script world: make the walker fail on any element that carries data-boom.
	await inEditor(`window.__orig = Element.prototype.getAttributeNames
		Element.prototype.getAttributeNames = function () { if (Element.prototype.hasAttribute.call(this, 'data-boom')) throw new Error('boom'); return window.__orig.call(this) }`)
	await page.eval(`document.execCommand('insertHTML', false, '<b data-boom="1">gone</b>')`)
	await sleep(500)
	assert.doesNotMatch(await editorHtml(page), /gone|data-boom/, 'added node removed')
	assert.match(await editorHtml(page), /before/, 'user content kept')
	// A changed attribute is dropped, the element stays.
	await inEditor(`ed.append(Object.assign(document.createElement('b'), { textContent: 'kept' }))`)
	await sleep(300)
	await inEditor(`ed.querySelector('b').setAttribute('onclick', 'window.__pwn=1'); ed.querySelector('b').setAttribute('data-boom', '1')`)
	await sleep(500)
	assert.match(await editorHtml(page), /<b[^>]*>kept<\/b>/)
	assert.doesNotMatch(await editorHtml(page), /onclick|data-boom/)
	await inEditor(`Element.prototype.getAttributeNames = window.__orig`)
	// The observer is still alive.
	await page.eval(`window.__root = null; document.execCommand('insertHTML', false, ${JSON.stringify(ROOT_IMG)})`)
	await sleep(700)
	const saved = await assertHeld(page, c, 'after a failed guard run')
	assert.match(saved.content, /before/)
})

test('markup the page undoes with input events stopped does not reach the saved note', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`(() => { let stop = false; window.addEventListener('input', (e) => { if (stop) e.stopImmediatePropagation() }, true)
		document.execCommand('insertHTML', false, '<img src=x onerror="window.__pwn=1"><a href="javascript:alert(1)">JS</a><iframe src="https://example.invalid/"></iframe>')
		stop = true; document.execCommand('undo'); stop = false })()`)
	await sleep(800)
	const saved = await saveNow(c)
	assert.doesNotMatch(saved.content, MARKUP, saved.content)
	assert.match(saved.content, /before/)
})

test('markup a page plants and undoes while the user presses Save does not reach the saved note', async () => {
	const { page, c } = await openPageEditor()
	await page.type('typed ')
	await page.eval(`(() => { let stop = false; window.addEventListener('input', (e) => { if (stop) e.stopImmediatePropagation() }, true)
		window.addEventListener('mousedown', () => { document.execCommand('insertHTML', false, '<img src=x onerror="window.__pwn=1">MD'); stop = true; document.execCommand('undo'); stop = false }, true) })()`)
	const saved = await saveNow(c)
	assert.doesNotMatch(saved.content, MARKUP, saved.content)
	assert.match(saved.content, /before typed/)
})

test('an is= value does not stay in the editor or in the saved note', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`document.execCommand('insertHTML', false, '<span is="x-span">IS</span>')`)
	await sleep(500)
	assert.doesNotMatch(await editorHtml(page), /\bis=/)
	const saved = await saveNow(c)
	assert.doesNotMatch(saved.content, /\bis=/, saved.content)
	assert.match(saved.content, />IS</)
})

test('typing that only changes existing text is saved even when the page stops keydown and input', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`for (const type of ['keydown', 'input']) window.addEventListener(type, (e) => e.stopImmediatePropagation(), true)`)
	await page.type('TYPED')
	assert.match(await editorHtml(page), /before TYPED/)
	const saved = await saveNow(c)
	assert.match(saved.content, /before(&nbsp;| )TYPED/, saved.content)
})

test('attributes named like Object.prototype members are dropped without a throw, in the live editor and in a stored note', async () => {
	const html = '<a href="https://example.com/" constructor="x" __proto__="y" toString="z">L</a>'
	const { page } = await openPageEditor()
	await page.eval(`document.execCommand('insertHTML', false, ${JSON.stringify(html)})`)
	await sleep(500)
	assert.deepEqual(await page.eval(`[...${EDITOR}.querySelectorAll('a')].map((a) => a.getAttribute('href') + ' ' + a.getAttributeNames().filter((n) => n !== 'href' && n !== 'style'))`, 'content'), ['https://example.com/ '])
	const stored = await editorState(await openPlantedEditor(html))
	assert.deepEqual(stored.attrs.filter((a) => a !== 'a.style'), ['a.href'], stored.html)
	assert.deepEqual(stored.tags, ['a'])
})


/* ---- bottom search bar ---- */

const stamp = new Date().toString()
const plainNote = (id, title, content, origin = null) => ({ id, title, content, origin, color: { name: 'yellow', styles: { card: 'bg-yellow-200', top: 'bg-yellow-400' } }, created: stamp, modified: stamp })
const cardOpacity = (page, id) => page.eval(`getComputedStyle(document.querySelector('#note-card-${id}')).opacity`)
const faded = async (page, id) => Number(await cardOpacity(page, id)) < 0.5

test('search bar: "/note" with a title creates a note', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.fill('#searchInput', '/note "Typed in the bar"')
	await waitFor(async () => (await n.text()).toLowerCase().includes('create note'), 'status line for the command')
	await pressKey(page, 'Enter')
	const [saved] = await waitFor(async () => { const l = await notes(); return l.length && l }, 'note in IndexedDB')
	assert.equal(saved.title, 'Typed in the bar')
	await waitFor(async () => (await n.text()).toLowerCase().includes('note created'), 'status notice')
	assert.equal(await page.eval(`document.querySelector('#searchInput').value`), '')
	await waitFor(async () => (await n.text()).includes('Typed in the bar'), 'note card on the page')
	assert.deepEqual(b.errors, [])
})

test('search bar: "/notebook" with a title creates a notebook', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.fill('#searchInput', '/notebook "Bar volume"')
	await pressKey(page, 'Enter')
	const [book] = await waitFor(async () => { const l = await notebooks(); return l.length && l }, 'notebook in IndexedDB')
	assert.equal(book.title, 'Bar volume')
	assert.deepEqual(b.errors, [])
})

test('search bar: the command row shows the vermilion left bar', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.fill('#searchInput', '/no')
	await n.appear('#search-command-note')
	assert.equal(await page.eval(`getComputedStyle(document.querySelector('#search-command-note')).borderLeftColor`), await page.eval(`(() => { const e = document.createElement('i'); e.className = 'border-l-vermilion border-l'; document.body.append(e); const c = getComputedStyle(e).borderLeftColor; e.remove(); return c })()`))
})

test('search bar: matching reads content, origin and volume, and the rest fade', async () => {
	await b.post('notate', 'NOTES', plainNote(1, 'Alpha', '<div>garden <b>tomatoes</b></div>'))
	await b.post('notate', 'NOTES', plainNote(2, 'Beta', 'nothing here', 'https://harvest.example/page'))
	await b.post('notate', 'NOTES', plainNote(3, 'Gamma', 'unrelated words'))
	await b.post('notate', 'NOTES', plainNote(4, 'Filed', 'stored in a volume with zebra'))
	await b.post('notate', 'NOTEBOOKS', { id: 1, title: 'Savanna', description: 'x', collection: [4], created: stamp, modified: stamp })
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#note-card-3')

	await n.fill('#searchInput', 'tomatoes')
	await waitFor(async () => (await faded(page, 3)) && (await faded(page, 2)) && !(await faded(page, 1)), 'content match')

	await page.eval(`(() => { const i = document.querySelector('#searchInput'); i.focus(); i.select() })()`)
	await page.type('harvest.example')
	await waitFor(async () => (await faded(page, 1)) && !(await faded(page, 2)), 'origin match')

	await page.eval(`(() => { const i = document.querySelector('#searchInput'); i.focus(); i.select() })()`)
	await page.type('zebra')
	await waitFor(async () => (await faded(page, 1)) && (await faded(page, 2)), 'only the volume matches')
	assert.equal(await page.eval(`getComputedStyle(document.querySelector('#notebook-card-1')).opacity`), '1', 'volume stays')
	assert.ok(!(await n.text()).includes('Nothing in your notes'), 'no empty message while a volume matches')

	await page.eval(`(() => { const i = document.querySelector('#searchInput'); i.focus(); i.select() })()`)
	await page.type('qqqq')
	await n.appear('#no-items-found-container')
	assert.deepEqual(b.errors, [])
})

test('search bar: the term survives a saved edit', async () => {
	await b.post('notate', 'NOTES', plainNote(1, 'Alpha', 'garden tomatoes'))
	await b.post('notate', 'NOTES', plainNote(2, 'Beta', 'plain words'))
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#note-card-2')
	await n.fill('#searchInput', 'tomatoes')
	await waitFor(() => faded(page, 2), 'non-matching card fades')
	await n.click('#note-card-1')
	await n.fill('#edit-note-title', ' edited')
	await n.click('#save-btn')
	await waitFor(async () => (await notes()).some((x) => x.title.includes('edited')), 'edit saved')
	await n.gone('#save-btn')
	await sleep(500)
	assert.equal(await page.eval(`document.querySelector('#searchInput').value`), 'tomatoes')
	assert.ok(await faded(page, 2), 'the other card is still faded')
	assert.ok(!(await faded(page, 1)), 'the edited card still matches')
	assert.deepEqual(b.errors, [])
})

test('search bar: an engine pick is stored by patch and leaves other settings alone', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	const before = await waitFor(config, 'seeded config')
	assert.equal(before.Notate.search.preferredEngine.value, 'perplexityai')
	await n.hover('#search-bar-tab')
	await n.click('#search-engine-chip')
	await n.appear('#search-engine-menu')
	await n.click('#search-engine-duckduckgo')
	await waitFor(async () => (await config()).Notate.search.preferredEngine.value === 'duckduckgo', 'engine saved')
	const after = await config()
	assert.equal(after.Notate.search.searchNotes.value, before.Notate.search.searchNotes.value, 'searchNotes untouched')
	assert.equal(after.WebContent.behavior.contextMenuPopup.value, 'true', 'other sections untouched')
	assert.equal((await b.idb()).USER_CONFIGURATION_DB.USER_CONFIGURATION.length, 1, 'still one config record')
	assert.equal(await page.eval(`document.querySelector('#search-engine-chip').dataset.engine`), 'duckduckgo')
	await page.send('Page.reload')
	await n.appear('#search-engine-chip')
	await waitFor(async () => (await page.eval(`document.querySelector('#search-engine-chip').dataset.engine`)) === 'duckduckgo', 'engine after reload')
	// The icons are real files in the build.
	await n.hover('#search-bar-tab')
	await waitFor(() => page.eval(`(() => { const i = document.querySelector('#search-engine-chip img'); return i.complete && i.naturalWidth > 0 })()`), 'chip icon loaded')
	assert.deepEqual(b.errors, [])
})

test('search bar: Enter opens the chosen engine in the current tab', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await waitFor(config, 'seeded config')
	// Pick DuckDuckGo with the keyboard: Alt+E, move to the option, Enter.
	await page.eval(`document.querySelector('#searchInput').focus()`)
	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'e', code: 'KeyE', modifiers: 1, windowsVirtualKeyCode: 69 })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'e', code: 'KeyE', modifiers: 1, windowsVirtualKeyCode: 69 })
	await n.appear('#search-engine-menu')
	await page.eval(`document.querySelector('#search-engine-duckduckgo').focus()`)
	await pressKey(page, 'Enter')
	await waitFor(async () => (await config()).Notate.search.preferredEngine.value === 'duckduckgo', 'engine saved')
	await n.gone('#search-engine-menu')
	// The test browser has no network: answer the engine request ourselves and note the URL.
	await page.send('Fetch.enable', { patterns: [{ urlPattern: '*duckduckgo.com*' }] })
	const seen = new Promise((resolve) => b.cdp.on((m) => {
		if (m.sessionId === page.sessionId && m.method === 'Fetch.requestPaused') {
			resolve(m.params.request.url)
			page.send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, body: Buffer.from('<title>engine</title>').toString('base64') }).catch(() => {})
		}
	}))
	await n.fill('#searchInput', 'two words')
	await pressKey(page, 'Enter')
	assert.equal(await Promise.race([seen, sleep(10000).then(() => 'no request')]), 'https://duckduckgo.com/?q=two%20words')
})

test('search bar: "/" raises the bar, but not while typing in another field or with a modal open', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#searchInput')
	const rising = () => page.eval(`document.querySelector('#search-bar-dock').classList.contains('up')`)
	assert.equal(await rising(), false, 'tucked at rest')
	// The hover zone beside the tab raises it too.
	const spot = await page.eval(`(() => { const r = document.querySelector('#search-bar-hot').getBoundingClientRect(); return { x: r.left + 8, y: r.bottom - 8 } })()`)
	assert.equal(await page.eval(`document.elementFromPoint(${spot.x}, ${spot.y})?.id`), 'search-bar-hot')
	await page.mouse('mouseMoved', spot.x, spot.y)
	await waitFor(rising, 'bar raised by the hover zone')
	await page.mouse('mouseMoved', 100, 300)
	await waitFor(async () => !(await rising()), 'bar tucks after the pointer leaves')
	await pressKey(page, '/', { text: '/' })
	await waitFor(async () => (await page.eval(`document.activeElement.id`)) === 'searchInput', 'focus on the bar')
	await waitFor(rising, 'bar raised')
	await pressKey(page, 'Escape')
	await waitFor(async () => !(await rising()), 'tucks after Esc')
	// A modal blocks the key.
	await n.hover('#search-bar-tab')
	await n.click('#new-note-button')
	await n.appear('#edit-note-title')
	await page.eval(`document.activeElement.blur()`)
	await pressKey(page, '/', { text: '/' })
	assert.notEqual(await page.eval(`document.activeElement.id`), 'searchInput')
	// Typing "/" in a field of the open editor keeps the character and leaves focus there.
	await n.click('#edit-note-title')
	await pressKey(page, '/', { text: '/' })
	assert.equal(await page.eval(`document.activeElement.id`), 'edit-note-title')
	assert.equal(await page.eval(`document.querySelector('#edit-note-title').value`), '/')
})

test('search bar: "/" and Alt+E still work after a notebook delete or cancel', async () => {
	await b.post('notate', 'NOTEBOOKS', { id: 1, title: 'Doomed book', description: 'x', collection: [], created: stamp, modified: stamp })
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	const focusBar = async (what) => {
		await page.eval(`document.activeElement.blur()`)
		await pressKey(page, '/', { text: '/' })
		await waitFor(async () => (await page.eval(`document.activeElement.id`)) === 'searchInput', what)
		await pressKey(page, 'Escape')
	}
	// Cancel the delete, close the notebook, then try the key.
	await n.click('#notebook-card-1')
	await n.click('#delete-notebook-btn')
	await n.appear('#confirmation-modal')
	await n.click('#cancel-btn')
	await n.gone('#confirmation-modal')
	await n.click('#close-modal-button')
	await n.gone('#notebook-title')
	await focusBar('"/" after a cancelled delete')
	// Confirm the delete, then try the key.
	await n.click('#notebook-card-1')
	await n.click('#delete-notebook-btn')
	await n.appear('#confirmation-modal')
	await n.click('#action-btn')
	await waitFor(async () => (await notebooks()).length === 0, 'notebook deleted')
	await n.gone('#confirmation-modal')
	await focusBar('"/" after a delete')
	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'e', code: 'KeyE', modifiers: 1, windowsVirtualKeyCode: 69 })
	await n.appear('#search-engine-menu')
	assert.deepEqual(b.errors, [])
})

test('search bar: Alt+E does not take AltGr+E, which types a character', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#searchInput')
	await page.eval(`window.__prevented = null; document.addEventListener('keydown', (e) => { window.__prevented = e.defaultPrevented }, { capture: false })`)
	await page.eval(`document.querySelector('#searchInput').focus()`)
	// AltGr arrives as Ctrl+Alt with the typed character as the key.
	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: '€', code: 'KeyE', modifiers: 3, windowsVirtualKeyCode: 69 })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: '€', code: 'KeyE', modifiers: 3, windowsVirtualKeyCode: 69 })
	await sleep(300)
	assert.equal(await page.eval(`!!document.querySelector('#search-engine-menu')`), false, 'menu stays shut')
	assert.equal(await page.eval(`window.__prevented`), false, 'the key is left alone, so the character can be typed')
})

test('search bar: an IME composition is not a command or a search', async () => {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.fill('#searchInput', '/note "composed"')
	// Enter that picks an IME candidate arrives with keyCode 229.
	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229 })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229 })
	await sleep(600)
	assert.equal((await notes()).length, 0, 'no note from a composing Enter')
	assert.equal(await page.eval(`document.querySelector('#searchInput').value`), '/note "composed"')
	await pressKey(page, 'Enter')
	await waitFor(async () => (await notes()).length === 1, 'note from the real Enter')
	assert.deepEqual(b.errors, [])
})

test('search bar: "/note" takes its colour from the settings', async () => {
	await waitFor(config, 'seeded config')
	await b.request('PATCH_DATABASE', { database: 'userConfiguration', store: 'USER_CONFIGURATION', data: { Notate: { noteModal: { preferredColor: { value: 'green' } } } } })
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.fill('#searchInput', '/note "Green by setting"')
	await pressKey(page, 'Enter')
	const [saved] = await waitFor(async () => { const l = await notes(); return l.length && l }, 'note in IndexedDB')
	assert.equal(saved.color.name, 'green')
	assert.ok(saved.color.styles, 'stored in the same shape as the editor writes')
})

test('search bar: a stored engine that is not a real engine falls back to the default, and picking the default repairs it', async () => {
	await waitFor(config, 'seeded config')
	for (const bad of ['constructor', 'gone-engine']) {
		await b.request('PATCH_DATABASE', { database: 'userConfiguration', store: 'USER_CONFIGURATION', data: { Notate: { search: { preferredEngine: { value: bad } } } } })
		const page = await b.openPage(NEWTAB)
		const n = ui(page)
		await n.appear('#search-engine-chip')
		assert.equal(await page.eval(`document.querySelector('#search-engine-chip').dataset.engine`), 'perplexityai', `${bad} shows the default`)
		await n.hover('#search-bar-tab')
		await n.click('#search-engine-chip')
		await n.appear('#search-engine-menu')
		await n.click('#search-engine-perplexityai')
		await waitFor(async () => (await config()).Notate.search.preferredEngine.value === 'perplexityai', `${bad} repaired`)
	}
	assert.deepEqual(b.errors, [])
})

test('search bar: a drag tucks the bar and raises the trash, and both return afterwards', async () => {
	await b.post('notate', 'NOTES', plainNote(1, 'Draggable', 'x'))
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#note-card-1')
	await n.hover('#search-bar-tab')
	await waitFor(() => page.eval(`document.querySelector('#search-bar-dock').classList.contains('up')`), 'bar raised')
	await page.eval(`(() => {
		const dt = new DataTransfer(); dt.setData('text/plain', '{}')
		document.querySelector('#note-card-1').dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
	})()`)
	await waitFor(() => page.eval(`document.querySelector('#search-bar-dock').classList.contains('dragging')`), 'bar tucks')
	await waitFor(() => page.eval(`document.querySelector('#drag-to-trash-hover-region').classList.contains('on')`), 'trash rises')
	await page.eval(`(() => {
		const dt = new DataTransfer()
		document.querySelector('#drag-to-trash-handler').dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
	})()`)
	await waitFor(() => page.eval(`document.querySelector('#drag-to-trash-hover-region').classList.contains('over')`), 'over-trash state')
	await page.eval(`document.querySelector('#note-card-1').dispatchEvent(new DragEvent('dragend', { bubbles: true }))`)
	await waitFor(async () => !(await page.eval(`document.querySelector('#drag-to-trash-hover-region').classList.contains('on')`)), 'trash tucks')
	assert.equal(await page.eval(`document.querySelector('#search-bar-dock').classList.contains('dragging')`), false)
	assert.deepEqual(b.errors, [])
})


/* ---- board layout ---- */

const USER_CONFIGURATION = 'userConfiguration'
const patchConfig = (data) => b.request('PATCH_DATABASE', { database: USER_CONFIGURATION, store: 'USER_CONFIGURATION', data })
const patchRecord = (store, id, data) => b.request('PATCH_DATABASE', { database: 'notate', store, id, data })
const boardNote = (id, x, y, extra = {}) => ({ ...plainNote(id, `Note ${id}`, `body ${id}`), board: { x, y, r: 0, z: id }, ...extra })
const boardBook = (id, x, y, collection = [], w = 540, h = 330) => ({ id, title: `Book ${id}`, description: 'about', collection, board: { x, y, w, h }, created: stamp, modified: stamp })

// Stores the records, turns the board on and pins the view at 0, 0, 100% so world and screen coordinates differ only by the 84 px strip.
async function seedBoard({ notes: ns = [], books = [], on = true } = {}) {
	await waitFor(config, 'seeded config')
	for (const note of ns) await b.post('notate', 'NOTES', note)
	for (const book of books) await b.post('notate', 'NOTEBOOKS', book)
	await patchConfig({ Notate: { page: { boardLayout: { value: String(on) } }, board: { view: { x: 0, y: 0, z: 1 } } } })
}
const centre = (page, sel) => page.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
const trashPoint = (page) => page.eval(`(() => { const r = document.querySelector('#drag-to-trash-hover-region').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.bottom - 5 * parseFloat(getComputedStyle(document.documentElement).fontSize) } })()`)
async function drag(page, from, to, steps = 14) {
	await page.mouse('mouseMoved', from.x, from.y)
	await page.mouse('mousePressed', from.x, from.y, { buttons: 1 })
	for (let i = 1; i <= steps; i++) {
		await page.mouse('mouseMoved', from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps, { buttons: 1 })
		await sleep(20)
	}
	await sleep(80)
	await page.mouse('mouseReleased', to.x, to.y)
}
const savedBoard = async (store, id) => ((await b.idb()).NOTATE_DB[store].find((x) => x.id === id) ?? {}).board
const pick = ({ x, y }) => ({ x, y })
const translateOf = (page, sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).style.translate`)
const boardPage = async () => { const page = await b.openPage(NEWTAB); const n = ui(page); await n.appear('#board'); return { page, n } }

test('board: off shows the grid, on shows the board, and switching back loses nothing', async () => {
	await seedBoard({ on: false, notes: [boardNote(1, 100, 100), boardNote(2, 400, 100)], books: [boardBook(1, 700, 200, [2])] })
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#note-card-1')
	assert.equal(await n.exists('#board'), false, 'no board when off')
	const flip = async () => {
		await n.click('#settings-widget')
		await n.appear('#settings-modal')
		await waitFor(() => page.eval(`document.querySelectorAll('#checkbox-option input').length >= 3`), 'settings options')
		await page.eval(`document.querySelectorAll('#checkbox-option input')[1].click()`) // second checkbox: Notate.page.boardLayout
		await n.click('#save-settings-button')
	}
	await flip()
	await n.appear('#board')
	await n.gone('#note-card-1')
	assert.equal((await config()).Notate.page.boardLayout.value, 'true')
	await n.appear('#board-note-1')
	await n.appear('#board-frame-1')
	await flip()
	await n.appear('#note-card-1')
	await n.gone('#board')
	assert.equal((await config()).Notate.page.boardLayout.value, 'false')
	assert.deepEqual((await notes()).map((x) => x.title).sort(), ['Note 1', 'Note 2'])
	assert.deepEqual((await notebooks())[0].collection, [2])
	assert.deepEqual((await notes()).find((x) => x.id === 1).board, { x: 100, y: 100, r: 0, z: 1 }, 'positions kept for the next time')
	assert.deepEqual(b.errors, [])
})

test('board: a config saved before the setting existed gains it through the merge', async () => {
	const old = await waitFor(config, 'seeded config')
	delete old.Notate.page.boardLayout
	old.Notate.search.preferredEngine.value = 'google'
	await b.post(USER_CONFIGURATION, 'USER_CONFIGURATION', old)
	const merged = await waitFor(async () => { const c = await config(); return c.Notate.page.boardLayout && c }, 'merged setting')
	assert.equal(merged.Notate.page.boardLayout.value, 'false', 'off by default')
	assert.equal(merged.Notate.search.preferredEngine.value, 'google', 'saved choices kept')
	const page = await b.openPage(NEWTAB)
	await ui(page).appear('#page-title')
	assert.equal(await ui(page).exists('#board'), false)
	assert.deepEqual(b.errors, [])
})

test('board: dragging a note moves it, and the place is kept after a reload', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 800, 150)] })
	const { page, n } = await boardPage()
	const from = await n.center('#board-note-1')
	await drag(page, from, { x: from.x + 300, y: from.y + 120 })
	await waitFor(async () => (await savedBoard('NOTES', 1))?.x === 500, 'new place saved')
	const saved = await savedBoard('NOTES', 1)
	assert.equal(saved.y, 270)
	assert.deepEqual(await savedBoard('NOTES', 2), { x: 800, y: 150, r: 0, z: 2 }, 'the other note stays')
	await page.send('Page.reload')
	await n.appear('#board-note-1')
	assert.equal(await translateOf(page, '#board-note-1'), '500px 270px')
	assert.equal(await translateOf(page, '#board-note-2'), '800px 150px')
	assert.deepEqual(b.errors, [])
})

test('board: a click opens the note, and a small wobble does not move it', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150)] })
	const { page, n } = await boardPage()
	const at = await n.center('#board-note-1')
	await page.mouse('mouseMoved', at.x, at.y)
	await page.mouse('mousePressed', at.x, at.y, { buttons: 1 })
	await page.mouse('mouseMoved', at.x + 3, at.y + 2, { buttons: 1 })
	await page.mouse('mouseReleased', at.x + 3, at.y + 2)
	await n.appear('#edit-note-title')
	assert.match(await page.eval(`document.querySelector('#edit-note-title').value`), /Note 1/)
	assert.deepEqual(await savedBoard('NOTES', 1), { x: 200, y: 150, r: 0, z: 1 })
	assert.deepEqual(b.errors, [])
})

test('board: dropping a note in a volume files it, taking it out onto paper unfiles it', async () => {
	await seedBoard({ notes: [boardNote(1, 100, 150)], books: [boardBook(1, 700, 200)] })
	const { page, n } = await boardPage()
	const from = await n.center('#board-note-1')
	const inside = await n.center('#board-frame-1')
	await drag(page, from, inside)
	await waitFor(async () => (await notebooks())[0].collection.includes(1), 'note filed')
	await waitFor(async () => (await page.eval(`document.querySelector('#board-note-1').textContent`)).includes('Book 1'), 'note shows its volume')
	const filed = await centre(page, '#board-note-1')
	await drag(page, filed, { x: 150, y: 600 })
	await waitFor(async () => (await notebooks())[0].collection.length === 0, 'note taken out')
	const out = await savedBoard('NOTES', 1)
	assert.ok(out.x < 400 && out.y > 400, 'it stays where it was dropped')
	assert.deepEqual(b.errors, [])
})

test('board: a volume moving over a loose note does not file it', async () => {
	await seedBoard({ notes: [boardNote(1, 100, 520)], books: [boardBook(1, 700, 200)] })
	const { page, n } = await boardPage()
	const plate = await n.center('#board-plate-1')
	await drag(page, plate, { x: plate.x - 600, y: plate.y })
	await waitFor(async () => (await savedBoard('NOTEBOOKS', 1))?.x < 200, 'volume moved')
	const frame = await savedBoard('NOTEBOOKS', 1)
	assert.ok(frame.x + frame.w > 100, 'it now overlaps the note')
	assert.deepEqual((await notebooks())[0].collection, [])
	assert.match(await page.eval(`document.querySelector('#board-frame-1').getAttribute('aria-label')`), /0 notes/)
	assert.deepEqual(await savedBoard('NOTES', 1), { x: 100, y: 520, r: 0, z: 1 }, 'the note stays')
	assert.deepEqual(b.errors, [])
})

test('board: moving a volume moves the notes filed in it', async () => {
	await seedBoard({ notes: [boardNote(1, 730, 260), boardNote(2, 100, 150)], books: [boardBook(1, 700, 200, [1])] })
	const { page, n } = await boardPage()
	const plate = await n.center('#board-plate-1')
	await drag(page, plate, { x: plate.x + 200, y: plate.y + 100 })
	await waitFor(async () => (await savedBoard('NOTES', 1))?.x === 930, 'filed note moved')
	assert.equal((await savedBoard('NOTES', 1)).y, 360)
	assert.deepEqual(await savedBoard('NOTEBOOKS', 1), { x: 900, y: 300, w: 540, h: 330 })
	assert.deepEqual(await savedBoard('NOTES', 2), { x: 100, y: 150, r: 0, z: 2 }, 'a loose note stays')
	assert.deepEqual(b.errors, [])
})

test('board: a position save keeps an edit made elsewhere, and an editor save keeps a newer position', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 800, 150)] })
	const { page, n } = await boardPage()
	// Content edited from another page while this board holds the old copy; then this board moves the note.
	await patchRecord('NOTES', 1, { content: '<div>edited elsewhere</div>' })
	const from = await n.center('#board-note-1')
	await drag(page, from, { x: from.x + 100, y: from.y + 100 })
	await waitFor(async () => (await savedBoard('NOTES', 1))?.x === 300, 'moved')
	assert.match((await notes()).find((x) => x.id === 1).content, /edited elsewhere/, 'the drag did not overwrite the content')
	// The editor is open on note 2; a position arrives from elsewhere; the editor then saves.
	await n.click('#board-note-2')
	await n.appear('#edit-note-title')
	await patchRecord('NOTES', 2, { board: { x: 900, y: 400, r: 0, z: 9 } })
	await n.fill('#edit-note-title', ' ZZZ')
	await n.click('#save-btn')
	await waitFor(async () => /ZZZ/.test((await notes()).find((x) => x.id === 2).title), 'editor saved')
	assert.deepEqual(await savedBoard('NOTES', 2), { x: 900, y: 400, r: 0, z: 9 }, 'the editor save did not reset the position')
	assert.deepEqual(b.errors, [])
})

test('board: zoom and pan are saved by patch and leave other settings alone', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150)] })
	await patchConfig({ Notate: { search: { preferredEngine: { value: 'google' } } } })
	const { page, n } = await boardPage()
	await n.click('#board-zoom-in')
	await waitFor(async () => (await config()).Notate.board.view.z === 1.25, 'zoom saved')
	await n.appear('#board-note-1')
	const empty = { x: 1100, y: 700 }
	await drag(page, empty, { x: empty.x - 160, y: empty.y - 90 })
	await waitFor(async () => (await config()).Notate.board.view.x !== undefined && (await config()).Notate.board.view.y < -50, 'pan saved')
	const c = await config()
	assert.equal(c.Notate.search.preferredEngine.value, 'google')
	assert.equal(c.Notate.page.boardLayout.value, 'true')
	assert.equal(c.WebContent.behavior.contextMenuPopup.value, 'true')
	const level = await page.eval(`document.querySelector('#board-zoom-level').textContent`)
	await page.send('Page.reload')
	await n.appear('#board-note-1')
	assert.equal(await page.eval(`document.querySelector('#board-zoom-level').textContent`), level)
	assert.equal((await b.idb()).USER_CONFIGURATION_DB.USER_CONFIGURATION.length, 1, 'still one config record')
	assert.deepEqual(b.errors, [])
})

test('board: a note with no place is given a free one and it is saved', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), plainNote(2, 'Old note', 'made before the board')] })
	const { page, n } = await boardPage()
	await waitFor(async () => (await savedBoard('NOTES', 2)), 'place saved')
	const placed = await savedBoard('NOTES', 2)
	assert.ok(Number.isFinite(placed.x) && Number.isFinite(placed.y))
	await n.appear('#board-note-2')
	const a = await page.eval(`(() => { const r = document.querySelector('#board-note-1').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] })()`)
	const c = await page.eval(`(() => { const r = document.querySelector('#board-note-2').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] })()`)
	assert.ok(c[0] >= a[2] || c[2] <= a[0] || c[1] >= a[3] || c[3] <= a[1], 'the two notes do not overlap')
	assert.deepEqual(await savedBoard('NOTES', 1), { x: 200, y: 150, r: 0, z: 1 }, 'the placed note stays')
	assert.deepEqual(b.errors, [])
})

test('board: a note made from the search bar is held after Save, and lands on the board when placed', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150)] })
	const { page, n } = await boardPage()
	await n.hover('#search-bar-tab')
	await n.click('#new-note-button')
	await n.fill('#edit-note-title', 'Fresh')
	await n.fill('#input-text-display', 'made on the board')
	await n.click('#save-btn')
	const made = await waitFor(async () => (await notes()).find((x) => x.title === 'Fresh'), 'new note saved')
	await n.appear('#board-held')
	await page.click(700, 420)
	await waitFor(async () => (await savedBoard('NOTES', made.id)), 'new note placed')
	await n.appear(`#board-note-${made.id}`)
	assert.deepEqual(b.errors, [])
})

test('board: tidy lines the notes up and saves it, and Undo puts them back', async () => {
	const start = { 1: [300, 500], 2: [900, 200], 3: [1000, 600] }
	await seedBoard({ notes: Object.entries(start).map(([id, [x, y]]) => boardNote(Number(id), x, y)) })
	const { n } = await boardPage()
	await n.click('#board-tidy')
	await waitFor(async () => { const t = await savedBoard('NOTES', 3); return t?.x === 80 && t?.y === 80 }, 'tidy saved')
	assert.deepEqual((await savedBoard('NOTES', 2)), { x: 328, y: 80, r: 0, z: 2 })
	await n.appear('#board-undo')
	await n.click('#board-undo')
	await waitFor(async () => (await savedBoard('NOTES', 3))?.x === 1000, 'undo saved')
	for (const [id, [x, y]] of Object.entries(start)) assert.deepEqual(await savedBoard('NOTES', Number(id)), { x, y, r: 0, z: Number(id) })
	assert.deepEqual(b.errors, [])
})

test('board: dragging a note to the trash asks, and deletes it only after Delete', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 800, 150)] })
	const { page, n } = await boardPage()
	const from = await n.center('#board-note-1')
	await drag(page, from, await trashPoint(page))
	await n.appear('#confirmation-modal')
	assert.match(await page.eval(`document.querySelector('#message').textContent`), /delete this note/)
	await n.click('#cancel-btn')
	await n.gone('#confirmation-modal')
	assert.equal((await notes()).length, 2, 'cancel keeps it')
	assert.equal(await translateOf(page, '#board-note-1'), '200px 150px', 'and it is back where it was')
	const again = await n.center('#board-note-1')
	await drag(page, again, await trashPoint(page))
	await n.appear('#confirmation-modal')
	await n.click('#action-btn')
	await waitFor(async () => (await notes()).length === 1, 'note deleted')
	assert.deepEqual((await notes()).map((x) => x.id), [2])
	assert.deepEqual(b.errors, [])
})

test('board: deleting a volume on the board keeps its notes where they were', async () => {
	await seedBoard({ notes: [boardNote(1, 730, 260)], books: [boardBook(1, 700, 200, [1])] })
	const { page, n } = await boardPage()
	const plate = await n.center('#board-plate-1')
	await drag(page, plate, await trashPoint(page))
	await n.appear('#confirmation-modal')
	assert.match(await page.eval(`document.querySelector('#message').textContent`), /notes stay/)
	await n.click('#action-btn')
	await waitFor(async () => (await notebooks()).length === 0, 'volume deleted')
	assert.deepEqual(await savedBoard('NOTES', 1), { x: 730, y: 260, r: 0, z: 1 })
	await n.appear('#board-note-1')
	assert.equal(await translateOf(page, '#board-note-1'), '730px 260px')
	assert.deepEqual(b.errors, [])
})

test('board: arrow keys nudge the focused note, Shift takes a larger step, and the place is saved', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150)] })
	const { page, n } = await boardPage()
	await n.center('#board-note-1')
	await page.eval(`document.querySelector('#board-note-1').focus()`)
	await pressKey(page, 'ArrowRight')
	await pressKey(page, 'ArrowDown', { modifiers: 8 })
	await waitFor(async () => (await savedBoard('NOTES', 1))?.x === 208, 'nudge saved')
	assert.deepEqual(pick(await savedBoard('NOTES', 1)), { x: 208, y: 190 })
	assert.deepEqual(b.errors, [])
})

test('board: a search fades what does not match, and the bar counts the matches', async () => {
	await seedBoard({ notes: [{ ...boardNote(1, 200, 150), title: 'Alpha garden' }, boardNote(2, 800, 150)] })
	const { page, n } = await boardPage()
	await n.hover('#search-bar-tab')
	await n.fill('#searchInput', 'garden')
	await waitFor(() => page.eval(`document.querySelector('#board-note-2').classList.contains('bd-faded')`), 'non-match fades')
	assert.equal(await page.eval(`document.querySelector('#board-note-1').classList.contains('bd-faded')`), false)
	assert.match(await page.eval(`document.querySelector('#search-status').textContent`), /1 note/)
	assert.deepEqual(b.errors, [])
})

test('board: turning the board on while a search is typed does not break the page', async () => {
	await seedBoard({ on: false, notes: [boardNote(1, 100, 100), boardNote(2, 400, 100)] })
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#note-card-1')
	await n.hover('#search-bar-tab')
	await n.fill('#searchInput', 'Note')
	await n.click('#settings-widget')
	await n.appear('#settings-modal')
	await waitFor(() => page.eval(`document.querySelectorAll('#checkbox-option input').length >= 3`), 'settings options')
	await page.eval(`document.querySelectorAll('#checkbox-option input')[1].click()`)
	await n.click('#save-settings-button')
	await n.appear('#board')
	await n.appear('#board-note-1')
	assert.match(await page.eval(`document.querySelector('#search-status').textContent`), /2 notes/)
	assert.deepEqual(b.errors, [])
})

test('board: a save the background cannot do is reported, and later moves still save', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 800, 150)] })
	const { page, n } = await boardPage()
	// The next write the service worker makes throws inside its transaction, so that one request fails.
	const sw = await b.serviceWorker()
	await sw.eval(`(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { IDBObjectStore.prototype.put = put; throw new Error('forced failure') } })()`)
	const one = await n.center('#board-note-1')
	await drag(page, one, { x: one.x, y: one.y + 220 })
	await waitFor(async () => /could not be saved/.test(await page.eval(`document.querySelector('#board-toast')?.textContent ?? ''`)), 'failure toast')
	b.errors.length = 0 // the forced failure is expected
	assert.deepEqual(pick(await savedBoard('NOTES', 1)), { x: 200, y: 150 }, 'the failed move was not stored')
	assert.equal(await translateOf(page, '#board-note-1'), '200px 150px', 'and the note is back where it was')
	const two = await n.center('#board-note-2')
	await drag(page, two, { x: two.x, y: two.y + 220 })
	await waitFor(async () => (await savedBoard('NOTES', 2)).y > 300, 'a later move saves')
	assert.deepEqual(b.errors, [])
})

test('board: the page editor, opened before the note was placed, keeps the place when it saves', async () => {
	await waitFor(config, 'seeded config')
	const { c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#edit-title', 'Page note')
	await c.fill('#input-text-display', 'written on a web page')
	await c.click('#save-note-btn')
	const [saved] = await waitFor(async () => { const x = await notes(); return x.length && x }, 'note in IndexedDB')
	// A second page opens the note in its editor, then the board places the note.
	const { c: c2 } = await openFixture(b, fx)
	await openContextMenu(c2)
	await c2.click('#context-item-page-notes')
	await c2.appear('#related-note-title')
	await c2.hover('#related-note-title')
	await c2.click('#related-note-title')
	await c2.appear('#edit-title')
	await patchRecord('NOTES', saved.id, { board: { x: 300, y: 200, r: 0, z: 5 } })
	await c2.fill('#input-text-display', ' and more')
	await c2.click('#save-note-btn')
	await waitFor(async () => /and more/.test((await notes())[0].content), 'edit saved')
	assert.deepEqual((await notes())[0].board, { x: 300, y: 200, r: 0, z: 5 }, 'the position survived the editor save')
	assert.deepEqual(b.errors, [])
})

/* ---- board: header, and placing a note after it is saved ---- */
const setViewport = (page, width, height = 900) => page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
const box = (page, sel) => page.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom } })()`)
const apart = (a, c) => a.r <= c.l || c.r <= a.l || a.b <= c.t || c.b <= a.t
// The live pan and zoom, read from the world's transform.
const viewOf = (page) => page.eval(`(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('#board-world')).transform); const r = document.querySelector('#board').getBoundingClientRect(); return { z: m.a, x: m.e, y: m.f, left: r.left, top: r.top } })()`)
const onBoard = (v, px, py) => ({ x: (px - v.left - v.x) / v.z, y: (py - v.top - v.y) / v.z })
const NOTE_W = 224, NOTE_H = 208
const placedNotes = async () => (await notes()).filter((x) => x.board)
function assertNoOverlap(list, what) {
	for (const a of list) for (const c of list) if (a.id < c.id) {
		const apartX = a.board.x + NOTE_W <= c.board.x || c.board.x + NOTE_W <= a.board.x, apartY = a.board.y + NOTE_H <= c.board.y || c.board.y + NOTE_H <= a.board.y
		assert.ok(apartX || apartY, `${what}: note ${a.id} and note ${c.id} overlap`)
	}
}
// Types a note into the editor opened by the New note button and presses Save. The pointer ends on the Save button.
async function saveNewNote(n, title) {
	await n.hover('#search-bar-tab')
	await n.click('#new-note-button')
	await n.fill('#edit-note-title', title)
	await n.fill('#input-text-display', `body of ${title}`)
	await n.click('#save-btn')
	const made = await waitFor(async () => (await notes()).find((x) => x.title === title), `note "${title}" saved`)
	await n.appear('#board-held')
	return made
}

test('board: the header keeps Settings, the counts and the date apart at every width, and shows the v1.2.1 logo', async () => {
	await seedBoard({ notes: [1, 2, 3, 4].map((i) => boardNote(i, 100 + i * 250, 150)), books: [boardBook(1, 200, 500)] })
	const { page, n } = await boardPage()
	await n.appear('#board-note-4')
	for (const w of [1024, 1280, 1440, 1920]) {
		await setViewport(page, w)
		await sleep(250)
		const [s, c, d, l] = await Promise.all(['#settings-widget', '#board-counts', '#board-date', '#board-logo'].map((sel) => box(page, sel)))
		assert.ok(apart(s, c), `Settings and the counts overlap at ${w}`)
		assert.ok(apart(c, d), `the counts and the date overlap at ${w}`)
		assert.ok(apart(l, d), `the logo and the date overlap at ${w}`)
		assert.ok(s.r <= w && s.l >= 0, `Settings is on screen at ${w}`)
	}
	assert.ok(await page.eval(`!!document.querySelector('#settings-widget').closest('.bd-top')`), 'Settings is in the header, not floating over it')
	// The logo is the file the extension has shipped since v1.2.1 (its sha-256 is that of the v1.2.1 blob).
	const logo = await page.eval(`(async () => { const img = document.querySelector('#board-logo'); const bytes = await (await fetch(img.src)).arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', bytes); return { src: img.getAttribute('src'), ok: img.naturalWidth > 0, sha: [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('') } })()`)
	assert.equal(logo.src, './Designs/notate-logo.svg')
	assert.ok(logo.ok, 'the logo loads')
	assert.equal(logo.sha, '71641128061539929bd0d616e396d94b23b8432390ba1be56f249a4897a3d7f7')
	assert.deepEqual(b.errors, [])
})

test('board: the "new notes land here" marker is gone, and a click on the paper leaves nothing behind', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150)] })
	const { page, n } = await boardPage()
	await n.appear('#board-note-1')
	await page.click(900, 500)
	await sleep(400)
	assert.ok(!(await n.exists('#bd-mark')) && !(await n.exists('.bd-mark')))
	assert.ok(!(await n.text()).toLowerCase().includes('new notes land here'))
	assert.deepEqual(b.errors, [])
})

test('board: a saved note follows the cursor, and one click places it at that board point under pan and zoom', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 500, 150)] })
	await patchConfig({ Notate: { board: { view: { x: -120, y: -40, z: .7 } } } })
	const { page, n } = await boardPage()
	await n.appear('#board-note-2')
	const made = await saveNewNote(n, 'Placed by click')
	assert.ok(await n.exists('#board-placing'), 'the hint shows while placing')
	assert.match(await page.eval(`document.querySelector('#board-placing').textContent`), /Click to place/)
	assert.equal((await notes()).find((x) => x.id === made.id).board, undefined, 'nothing is saved until the note is placed')
	const v = await viewOf(page)
	assert.ok(Math.abs(v.z - .7) < .01 && v.x < 0, 'the board is zoomed and panned')
	await page.mouse('mouseMoved', 700, 420)
	await sleep(150)
	const held = await box(page, '#board-held')
	assert.ok(Math.abs(held.l - (700 - NOTE_W / 2 * v.z)) < 10, `the note hangs at the cursor (left ${held.l})`)
	await page.click(700, 420)
	const spot = onBoard(v, 700, 420)
	const want = { x: Math.round(spot.x - NOTE_W / 2), y: Math.round(spot.y - 36) }
	const saved = await waitFor(async () => (await notes()).find((x) => x.id === made.id)?.board, 'placed note saved')
	assert.deepEqual({ x: saved.x, y: saved.y }, want, 'saved at the clicked board point')
	await n.gone('#board-placing')
	await n.appear(`#board-note-${made.id}`)
	await n.gone('#board-held')
	assert.ok(!(await n.exists('#edit-note-title')), 'the click placed the note and opened nothing')
	assert.deepEqual(b.errors, [])
})

test('board: a note placed on top of another note ends up in front of it, and a quick second click opens nothing', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 500, 150)] })
	const { page, n } = await boardPage()
	await n.appear('#board-note-2')
	const made = await saveNewNote(n, 'On top')
	const on = await centre(page, '#board-note-1')
	await page.mouse('mouseMoved', on.x, on.y)
	await sleep(100)
	await page.click(on.x, on.y)
	await page.click(on.x, on.y) // a double click: the second must not open the note under it
	await waitFor(async () => (await notes()).find((x) => x.id === made.id)?.board, 'placed')
	await sleep(700)
	const top = await page.eval(`document.elementFromPoint(${on.x}, ${on.y}).closest('.bd-note')?.dataset.id`)
	assert.equal(Number(top), made.id, 'the placed note is the one on top')
	assert.ok(!(await n.exists('#edit-note-title')), 'no editor opened')
	assert.deepEqual(b.errors, [])
})

test('board: the zoom rail works while a note is held, and the note stays held', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150)] })
	const { page, n } = await boardPage()
	await n.appear('#board-note-1')
	const made = await saveNewNote(n, 'Held through a zoom')
	assert.equal(await page.eval(`document.querySelector('#board-zoom-level').textContent`), '100%')
	await n.click('#board-zoom-in')
	await waitFor(async () => (await page.eval(`document.querySelector('#board-zoom-level').textContent`)) === '125%', 'zoomed in')
	assert.ok(await n.exists('#board-held') && await n.exists('#board-placing'), 'still placing')
	assert.equal((await notes()).find((x) => x.id === made.id).board, undefined, 'not placed by the rail click')
	await pressKey(page, 'Escape')
	await waitFor(async () => (await notes()).find((x) => x.id === made.id)?.board, 'dropped by Esc')
	assert.deepEqual(b.errors, [])
})

test('board: Esc drops the saved note into a free spot, even with the cursor over another note', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 500, 150)] })
	const { page, n } = await boardPage()
	await n.appear('#board-note-2')
	const made = await saveNewNote(n, 'Dropped by Esc')
	const on = await centre(page, '#board-note-1')
	await page.mouse('mouseMoved', on.x, on.y)
	await sleep(150)
	await pressKey(page, 'Escape')
	const saved = await waitFor(async () => (await notes()).find((x) => x.id === made.id)?.board, 'dropped note saved')
	assert.ok(Number.isFinite(saved.x) && Number.isFinite(saved.y))
	await n.gone('#board-placing')
	assertNoOverlap(await placedNotes(), 'after Esc')
	assert.deepEqual(b.errors, [])
})

test('board: "/note" follows the same path: Esc, or a click outside the board, drops it into a free spot', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 500, 150)] })
	const { page, n } = await boardPage()
	await n.appear('#board-note-2')
	const on = await centre(page, '#board-note-2')
	for (const [title, drop] of [['Slash one', () => pressKey(page, 'Escape')], ['Slash two', async () => { const h = await centre(page, '#board-date'); await page.click(h.x, h.y) }]]) {
		await page.mouse('mouseMoved', on.x, on.y)
		await n.fill('#searchInput', `/note "${title}"`)
		await waitFor(async () => (await n.text()).toLowerCase().includes('create note'), 'status line for the command')
		await pressKey(page, 'Enter')
		const made = await waitFor(async () => (await notes()).find((x) => x.title === title), `${title} saved`)
		await n.appear('#board-held')
		assert.equal((await notes()).find((x) => x.id === made.id).board, undefined, 'not placed yet')
		await drop()
		await waitFor(async () => (await notes()).find((x) => x.id === made.id)?.board, `${title} placed`)
		await n.gone('#board-held')
	}
	assert.equal((await placedNotes()).length, 4)
	assertNoOverlap(await placedNotes(), 'after "/note"')
	assert.deepEqual(b.errors, [])
})

test('board: a note saved on the new tab but never placed appears in a free spot on the next load', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150), boardNote(2, 500, 150)] })
	const { page, n } = await boardPage()
	await n.appear('#board-note-2')
	const made = await saveNewNote(n, 'Left hanging')
	assert.equal((await notes()).find((x) => x.id === made.id).board, undefined)
	await page.send('Page.reload')
	await n.appear(`#board-note-${made.id}`)
	await waitFor(async () => (await notes()).find((x) => x.id === made.id)?.board, 'free spot saved')
	assert.ok(!(await n.exists('#board-held')) && !(await n.exists('#board-placing')), 'a reload does not start placing')
	assertNoOverlap(await placedNotes(), 'after the reload')
	assert.deepEqual(b.errors, [])
})

test('board: a note made on a web page lands in a free spot, without placing', async () => {
	await seedBoard({ notes: [boardNote(1, 200, 150)] })
	const { c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#edit-title', 'From a page')
	await c.fill('#input-text-display', 'written on a web page')
	await c.click('#save-note-btn')
	const made = await waitFor(async () => (await notes()).find((x) => x.title === 'From a page'), 'page note saved')
	const { n } = await boardPage()
	await n.appear(`#board-note-${made.id}`)
	await waitFor(async () => (await notes()).find((x) => x.id === made.id)?.board, 'free spot saved')
	assert.ok(!(await n.exists('#board-held')) && !(await n.exists('#board-placing')))
	assertNoOverlap(await placedNotes(), 'page note')
	assert.deepEqual(b.errors, [])
})

test('a PATCH with no record id is refused for notes and does not touch the first record', async () => {
	await seedBoard({ notes: [boardNote(1, 100, 100)] })
	await b.request('PATCH_DATABASE', { database: 'notate', store: 'NOTES', data: { title: 'changed' } })
	await sleep(300)
	assert.equal((await notes())[0].title, 'Note 1')
	b.errors.length = 0 // the refusal is logged as an error
})

test('a web-page save that keeps failing is retried three times and then stops', async () => {
	await waitFor(config, 'seeded config')
	const { c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#edit-title', 'Doomed')
	await c.fill('#input-text-display', 'never stored')
	// Every write to NOTES fails in the service worker, and each failure is counted.
	const sw = await b.serviceWorker()
	await sw.eval(`(() => { const put = IDBObjectStore.prototype.put; globalThis.__fails = 0; IDBObjectStore.prototype.put = function () { if (this.name === 'NOTES') { globalThis.__fails++; throw new Error('forced failure') } return put.apply(this, arguments) } })()`)
	await c.click('#save-note-btn')
	await waitFor(async () => (await sw.eval('globalThis.__fails')) >= 4, 'the retries')
	await sleep(2500)
	assert.equal(await sw.eval('globalThis.__fails'), 4, 'one try and three retries, then it stops')
	assert.equal((await notes()).length, 0)
	b.errors.length = 0 // the forced failures are expected
})

// ---- Block formats: lists, checkbox, headings, quote ----

async function openNewTabEditor() {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.hover('#search-bar-tab')
	await n.click('#new-note-button')
	await n.fill('#edit-note-title', 'Blocks')
	await n.appear('#input-text-display')
	await page.eval(`document.querySelector('#input-text-display').focus()`)
	return { page, n }
}
const SPACE = { key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 }
const pressSpace = async (page) => {
	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...SPACE })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 })
}
const CTRL = 2
const shortcutLine = async (page, prefix, text) => { await page.type(prefix); await pressSpace(page); await page.type(text) }
// Each block of a stored note as [tag, data-checked, text].
const blocksOf = (html) => b.reader().then((r) => r.eval(`(() => {
	const d = new DOMParser().parseFromString(${JSON.stringify(html)}, 'text/html')
	return [...d.querySelectorAll('li, h1, h2, blockquote')].map((e) => [e.parentElement.localName === 'ol' ? 'ol>li' : e.localName, e.getAttribute('data-checked'), e.textContent.trim()])
})()`))

test('typed shortcuts make lists, a checkbox, headings and a quote that survive save and reopen', async () => {
	const { page, n } = await openNewTabEditor()
	await shortcutLine(page, '-', 'bullet'); await pressKey(page, 'Enter'); await pressKey(page, 'Enter')
	await shortcutLine(page, '1.', 'one'); await pressKey(page, 'Enter'); await pressKey(page, 'Enter')
	await shortcutLine(page, '[ ]', 'todo'); await pressKey(page, 'Enter'); await page.type('second')
	await pressKey(page, 'Enter', { modifiers: CTRL }) // Ctrl+Enter ticks the item the caret is in
	await pressKey(page, 'Enter'); await pressKey(page, 'Enter')
	await shortcutLine(page, '#', 'Big'); await pressKey(page, 'Enter')
	await shortcutLine(page, '##', 'Small'); await pressKey(page, 'Enter')
	await shortcutLine(page, '>', 'said')
	await n.click('#save-btn')
	const saved = await waitFor(async () => (await notes()).find((x) => x.title === 'Blocks'), 'saved note')
	const expected = [['li', null, 'bullet'], ['ol>li', null, 'one'], ['li', 'false', 'todo'], ['li', 'true', 'second'], ['h1', null, 'Big'], ['h2', null, 'Small'], ['blockquote', null, 'said']]
	assert.deepEqual(await blocksOf(saved.content), expected, saved.content)
	assert.doesNotMatch(saved.content, /<input|\[ \]|&gt;/, 'the typed prefixes are gone')
	// Reopen: the blocks come back from the stored note.
	const page2 = await b.openPage(NEWTAB)
	await ui(page2).click('#note-card-1')
	await waitFor(() => page2.eval(`document.querySelector('#input-text-display')?.querySelector('blockquote')`), 'editor filled with the note')
	const s = await editorState(page2)
	assert.deepEqual(['ul', 'ol', 'li', 'h1', 'h2', 'blockquote'].filter((t) => !s.tags.includes(t)), [], s.html)
	assert.deepEqual(b.errors, [])
})

test('a click on the box flips a checkbox item, and Enter starts the next item unchecked', async () => {
	const { page, n } = await openNewTabEditor()
	const checks = () => page.eval(`[...document.querySelectorAll('#input-text-display li')].map((e) => e.getAttribute('data-checked'))`)
	await shortcutLine(page, '[ ]', 'first')
	await pressKey(page, 'Enter', { modifiers: CTRL })
	assert.deepEqual(await checks(), ['true'])
	await pressKey(page, 'Enter')
	await page.type('second')
	assert.deepEqual(await checks(), ['true', 'false'], 'the new item is not copied as checked')
	await n.center('#input-text-display') // the modal has stopped sliding in
	const box = await page.eval(`(() => { const r = document.querySelector('#input-text-display li').getBoundingClientRect(); return { x: r.left - 8, y: r.top + r.height / 2 } })()`)
	await page.click(box.x, box.y)
	await waitFor(async () => (await checks())[0] === 'false', 'the first item unticked by a click on its box')
	await page.click(box.x + 40, box.y) // a click on the text does not flip it
	await sleep(300)
	assert.deepEqual(await checks(), ['false', 'false'])
})

test('block shortcuts and the checklist button also work in the editor on a web page', async () => {
	const { page, c } = await openPageEditor()
	await pressKey(page, 'Enter')
	await shortcutLine(page, '-', 'item')
	await pressKey(page, 'Enter'); await pressKey(page, 'Enter')
	await c.click('#checklist-btn')
	await page.type('todo')
	const html = await editorHtml(page)
	assert.match(html, /<ul[^>]*><li[^>]*>item<\/li>/, html)
	assert.match(html, /<li[^>]*data-checked="false"[^>]*>todo/, html)
	assert.doesNotMatch(html, /- item/, html)
	assert.deepEqual(b.errors, [])
})

test('every block toolbar button formats the line and a second press reverts it', async () => {
	const { page, n } = await openNewTabEditor()
	const buttons = ['bullet-list-btn', 'numbered-list-btn', 'checklist-btn', 'heading-1-btn', 'heading-2-btn', 'quote-btn']
	for (const [i, id] of buttons.entries()) {
		await n.click(`#${id}`)
		await page.type(`line${i}`)
		if (i < buttons.length - 1) { await pressKey(page, 'Enter'); if (i < 3) await pressKey(page, 'Enter') }
	}
	await n.click('#save-btn')
	const saved = await waitFor(async () => (await notes()).find((x) => x.title === 'Blocks'), 'saved note')
	assert.deepEqual(await blocksOf(saved.content), [['li', null, 'line0'], ['ol>li', null, 'line1'], ['li', 'false', 'line2'], ['h1', null, 'line3'], ['h2', null, 'line4'], ['blockquote', null, 'line5']], saved.content)
	// Pressing a button a second time on the same line undoes the format.
	const page2 = await b.openPage(NEWTAB)
	await ui(page2).click('#note-card-1')
	await waitFor(() => page2.eval(`document.querySelector('#input-text-display')?.querySelector('h1')`), 'editor filled with the note')
	await page2.eval(`(() => { const h = document.querySelector('#input-text-display h1'); getSelection().collapse(h.firstChild, 2) })()`)
	await ui(page2).click('#heading-1-btn')
	await waitFor(async () => !(await page2.eval(`!!document.querySelector('#input-text-display h1')`)), 'heading reverted')
	assert.match(await page2.eval(`document.querySelector('#input-text-display').textContent`), /line3/)
})

test('hostile block markup in a stored note loses every attribute except data-checked true or false', async () => {
	const page = await openPlantedEditor('<ul><li data-checked="javascript:1" onclick="window.__pwn=1">a</li><li data-checked="true" class="x" id="y">b</li><li data-checked="x">c</li></ul>'
		+ '<ol start="5" type="a" reversed><li value="9">d</li></ol><h1 style="position:fixed" onclick="window.__pwn=2">e</h1><h2 class="z">f</h2><blockquote cite="http://127.0.0.1:1/beacon" style="background:url(http://127.0.0.1:1/beacon)">g</blockquote>')
	await sleep(500)
	const s = await editorState(page)
	for (const t of ['ul', 'ol', 'li', 'h1', 'h2', 'blockquote']) assert.ok(s.tags.includes(t), `${t} kept: ${s.html}`)
	assert.doesNotMatch(s.html, /onclick|javascript|class=|id=|start=|type=|reversed|value=|cite=|position|background|x"/, s.html)
	assert.deepEqual(await page.eval(`[...document.querySelectorAll('#input-text-display li[data-checked]')].map((e) => e.getAttribute('data-checked'))`), ['true'])
	assert.equal(s.pwn, null)
	assert.equal(s.beacons, 0, 'nothing was requested')
})

test('pasted HTML with list items, inputs and handlers brings only its text', async () => {
	const { page } = await openNewTabEditor()
	await page.eval(`(() => {
		const dt = new DataTransfer()
		dt.setData('text/html', '<ul><li data-checked="true" onclick="window.__pwn=1"><input type=checkbox>html</li></ul>')
		dt.setData('text/plain', 'only text')
		document.querySelector('#input-text-display').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
	})()`)
	await sleep(300)
	const s = await editorState(page)
	assert.deepEqual(s.tags, [], s.html)
	assert.equal(s.text, 'only text')
	assert.equal(s.pwn, null)
})

test('a page script cannot put a data-checked value other than true or false into the page editor', async () => {
	const { page, c } = await openPageEditor()
	await page.eval(`document.execCommand('insertHTML', false, '<ul><li data-checked="x" onclick="window.__root=this.getRootNode()">z</li><li data-checked="true">t</li></ul>')`)
	await sleep(500)
	const html = await editorHtml(page)
	assert.doesNotMatch(html, /data-checked="x"|onclick/, html)
	assert.match(html, /data-checked="true"/)
	await assertHeld(page, c, 'data-checked')
})

test('note cards show lists, checkboxes, headings and quotes as plain lines, with no elements inside', async () => {
	await b.openPage(NEWTAB)
	await waitFor(config, 'seeded config')
	await plantNote('<ul><li>one</li><li>two</li></ul><ol><li>x</li><li>y</li></ol><ul><li data-checked="false">todo</li><li data-checked="true">done</li></ul><h1>Head</h1><blockquote>q</blockquote><div>tail</div>')
	const page = await b.openPage(NEWTAB)
	await ui(page).appear('[id$="-content"]')
	await sleep(500)
	const r = await page.eval(`(() => { const c = document.querySelector('#note-1-content'); return { text: c.textContent, kids: c.querySelectorAll('*:not(mark)').length, pre: getComputedStyle(c).whiteSpace } })()`)
	assert.equal(r.text.trim(), '• one\n• two\n1. x\n2. y\n☐ todo\n☑ done\nHead\n› q\ntail')
	assert.equal(r.kids, 0, 'no element created in a note card')
	assert.equal(r.pre, 'pre-line')
})
