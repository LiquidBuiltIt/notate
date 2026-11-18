import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, startFixture, openFixture, openContextMenu, dragAndDrop, ui, waitFor, sleep, EXT_ID, CONTENT_ROOT } from './helper.mjs'

// A web page is hostile. The content script is the part of the extension that lives in it, so what it can ask the
// background for, what it is sent back, and which events it believes are all checked here.

let b, fx
beforeEach(async () => { fx = await startFixture(); b = await launch() })
afterEach(async () => { await b.close(); fx.close() })

const HOST = '127.0.0.1'
const stores = async () => { const all = await b.idb(); return JSON.stringify({ notate: all.NOTATE_DB, config: all.USER_CONFIGURATION_DB }) }
const notes = async () => (await b.idb()).NOTATE_DB?.NOTES ?? []
const notebooks = async () => (await b.idb()).NOTATE_DB?.NOTEBOOKS ?? []
const config = async () => (await b.idb()).USER_CONFIGURATION_DB?.USER_CONFIGURATION?.[0]
const now = () => new Date().toString()
const note = (id, title, origin) => ({ id, title, content: `<p>${title}</p>`, origin, created: now(), modified: now() })

// Two notes on this site, and three that belong to other sites (one with this host as a prefix, one as a suffix).
async function seed() {
	await b.serviceWorker()
	await waitFor(config, 'seeded config')
	await b.post('notate', 'NOTES', note(1, 'Here', `${HOST}/`))
	await b.post('notate', 'NOTES', note(2, 'Here too', `${HOST}/deep/page`))
	await b.post('notate', 'NOTES', note(3, 'Other site', 'example.com/'))
	await b.post('notate', 'NOTES', note(4, 'Prefix', `${HOST}.evil.example/`))
	await b.post('notate', 'NOTES', note(5, 'Suffix', `x${HOST}/`))
	await b.post('notate', 'NOTEBOOKS', { id: 1, title: 'Book', description: 'd', collection: [3], created: now(), modified: now() })
}

// Sends one request on the data port and returns the reply. `world` 'content' is the content script, 'main' on an extension page is the new tab.
const ask = (page, world, message) => page.eval(`new Promise((res) => {
	const port = chrome.runtime.connect({ name: 'DATABASE_CONNECTION' })
	port.onMessage.addListener((m) => res(typeof m === 'string' ? JSON.parse(m) : m))
	port.postMessage(JSON.parse(${JSON.stringify(JSON.stringify(message))}))
	setTimeout(() => res({ type: 'no reply' }), 4000)
})`, world)
const asContent = (page, message) => ask(page, 'content', message)
const asNewTab = async (message) => ask(await b.reader(), 'main', message)
const titles = (reply, store = 'NOTES') => (reply.content?.data?.inventory?.[store] ?? []).map((n) => n.title).sort()
// The old reply could hold an inventory that was not loaded yet, so ask again until it holds notes.
const notesReply = (get) => waitFor(async () => { const r = await get(); return titles(r).length && r }, 'a reply with notes')
const op = (type, database, store, data, id) => ({ type, content: { database, store, data, id } })

// ---- The background checks who is asking, and what ----

test('a content script is sent only the notes of its own site, and never the error log', async () => {
	await seed()
	const { page } = await openFixture(b, fx)
	for (const type of ['GET_DATABASE', 'RELOAD_DATABASE']) {
		const reply = await notesReply(() => asContent(page, { type, content: { database: 'notate' } }))
		assert.deepEqual(titles(reply), ['Here', 'Here too'], `${type}: this site's notes only`)
		for (const book of reply.content.data.inventory.NOTEBOOKS) assert.deepEqual(Object.keys(book).sort(), ['collection', 'description', 'id', 'title'])
	}
	const log = await asContent(page, { type: 'GET_DATABASE', content: { database: 'errorLogging' } })
	assert.equal(log.content?.data, undefined, 'the error log is not sent')
	const created = await asContent(page, op('POST_DATABASE', 'notate', 'NOTES', { title: 'New', content: 'x', origin: `${HOST}/new`, created: now(), modified: now() }))
	assert.deepEqual(titles(created), ['Here', 'Here too', 'New'], 'the reply to a write holds this site only')
	const settings = await asContent(page, { type: 'GET_DATABASE', content: { database: 'userConfiguration' } })
	assert.ok(settings.content?.data?.inventory?.USER_CONFIGURATION?.[0]?.WebContent, 'the settings are sent')
})

test('the new tab page is still sent every note, and the error log', async () => {
	await seed()
	await b.openPage(`chrome-extension://${EXT_ID}/notate.html`)
	const reply = await notesReply(() => asNewTab({ type: 'GET_DATABASE', content: { database: 'notate' } }))
	assert.deepEqual(titles(reply), ['Here', 'Here too', 'Other site', 'Prefix', 'Suffix'])
	const log = await asNewTab({ type: 'GET_DATABASE', content: { database: 'errorLogging' } })
	assert.ok(log.content?.data, 'the error log is sent')
})

const DENIED = {
	'edit a note of another site': op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'pwned' }, 3),
	'edit a note of a look-alike host': op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'pwned' }, 4),
	'move a note to another site': op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'x', origin: 'example.com/' }, 1),
	'recolour a note': op('PATCH_DATABASE', 'notate', 'NOTES', { color: { name: 'red' } }, 1),
	'edit with a huge title': op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'x'.repeat(5000) }, 1),
	'edit with a title that is not text': op('PATCH_DATABASE', 'notate', 'NOTES', { title: { a: 1 } }, 1),
	'edit with no id': op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'pwned' }),
	'edit with a text id': op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'pwned' }, '1'),
	'edit many notes at once': op('PATCH_DATABASE', 'notate', 'NOTES', { $each: [{ id: 3, data: { title: 'pwned' } }, { id: 1, data: { title: 'pwned' } }] }),
	'overwrite a note by posting its id': op('POST_DATABASE', 'notate', 'NOTES', { id: 3, title: 'pwned', content: 'x', origin: `${HOST}/`, created: now(), modified: now() }),
	'post a note for another site': op('POST_DATABASE', 'notate', 'NOTES', { title: 'forged', content: 'x', origin: 'example.com/', created: now(), modified: now() }),
	'post a note for a look-alike host': op('POST_DATABASE', 'notate', 'NOTES', { title: 'forged', content: 'x', origin: `${HOST}.evil.example/`, created: now(), modified: now() }),
	'post a note with extra fields': op('POST_DATABASE', 'notate', 'NOTES', { title: 'forged', content: 'x', origin: `${HOST}/`, created: now(), modified: now(), color: 'x' }),
	'post a notebook': op('POST_DATABASE', 'notate', 'NOTEBOOKS', { id: 9, title: 'forged', description: '', collection: [], created: now(), modified: now() }),
	'replace the settings': op('POST_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { id: 1, WebContent: {} }),
	'write to the error log': op('POST_DATABASE', 'errorLogging', 'ERRORS', { id: 9, message: 'forged' }),
	'file a note of another site in a notebook': op('PATCH_DATABASE', 'notate', 'NOTEBOOKS', { collection: { $add: [3] } }, 1),
	'file a note that does not exist': op('PATCH_DATABASE', 'notate', 'NOTEBOOKS', { collection: { $add: [99] } }, 1),
	'take notes out of a notebook': op('PATCH_DATABASE', 'notate', 'NOTEBOOKS', { collection: { $remove: [3] } }, 1),
	'rename a notebook': op('PATCH_DATABASE', 'notate', 'NOTEBOOKS', { title: 'pwned' }, 1),
	'set a setting to a value it does not offer': op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { Notate: { search: { preferredEngine: { value: 'evil' } } } }),
	'add a setting': op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { Evil: { a: 1 } }),
	'change what a setting offers': op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { WebContent: { behavior: { contextMenuPopup: { options: ['x'] } } } }),
	'hide the menu on another site': op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { WebContent: { dismissedSites: { $add: ['example.com'] } } }),
	'replace the hidden sites': op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { WebContent: { dismissedSites: ['example.com'] } }),
	'delete a note of this site': op('DELETE_DATABASE', 'notate', 'NOTES', { id: 1 }),
	'delete a note of another site': op('DELETE_DATABASE', 'notate', 'NOTES', { id: 3 }),
	'delete a notebook': op('DELETE_DATABASE', 'notate', 'NOTEBOOKS', { id: 1 }),
	'delete in the error log': op('DELETE_DATABASE', 'errorLogging', 'ERRORS', { id: 1 }),
	'ask for something unknown': op('WIPE_DATABASE', 'notate', 'NOTES', {}),
	'ask for a database that does not exist': op('PATCH_DATABASE', 'other', 'NOTES', { title: 'pwned' }, 1),
	'send no body': { type: 'PATCH_DATABASE', content: null },
	'send a body that is text': { type: 'PATCH_DATABASE', content: 'notate' },
	'send a list as the data': op('PATCH_DATABASE', 'notate', 'NOTES', [{ title: 'pwned' }], 1),
}

test('a content script cannot change anything by asking for what it is not allowed, or with a malformed body', async () => {
	await seed()
	const { page } = await openFixture(b, fx)
	const before = await stores()
	for (const [what, message] of Object.entries(DENIED)) {
		const reply = await asContent(page, message)
		assert.equal(reply.content?.data, undefined, `${what}: nothing is sent back`)
	}
	// Written as text, so the key is an own property of the parsed body.
	const raw = '{"type":"PATCH_DATABASE","content":{"database":"notate","store":"NOTES","id":1,"data":{"__proto__":{"origin":"example.com/"},"title":"pwned"}}}'
	const reply = await page.eval(`new Promise((res) => { const port = chrome.runtime.connect({ name: 'DATABASE_CONNECTION' }); port.onMessage.addListener((m) => res(typeof m === 'string' ? JSON.parse(m) : m)); port.postMessage(JSON.parse(${JSON.stringify(raw)})); setTimeout(() => res({}), 4000) })`, 'content')
	assert.equal(reply.content?.data, undefined, 'a body with __proto__: nothing is sent back')
	await sleep(500)
	assert.equal(await stores(), before, 'every store is as it was')
})

test('a content script can still create and edit notes of its site, file them, and hide the menu on its site', async () => {
	await seed()
	const { page } = await openFixture(b, fx)

	await asContent(page, op('POST_DATABASE', 'notate', 'NOTES', { title: 'New', content: '<p>new</p>', origin: `${HOST}/new`, created: now(), modified: now() }))
	const [mine] = (await notes()).filter((n) => n.title === 'New')
	assert.ok(mine.id > 5, 'the note got a new id')

	await asContent(page, op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'Edited', content: '<p>edited</p>' }, 1))
	assert.equal((await notes()).find((n) => n.id === 1).content, '<p>edited</p>')
	assert.equal((await notes()).find((n) => n.id === 1).origin, `${HOST}/`, 'the note stays on its site')

	await asContent(page, op('PATCH_DATABASE', 'notate', 'NOTEBOOKS', { collection: { $add: [1, mine.id] } }, 1))
	assert.deepEqual((await notebooks())[0].collection.sort(), [1, 3, mine.id].sort(), 'filed next to what was already there')

	await asContent(page, op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { WebContent: { dismissedSites: { $add: [HOST] } } }))
	assert.deepEqual((await config()).WebContent.dismissedSites, [HOST])
	await asContent(page, op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { WebContent: { behavior: { contextMenuPopup: { value: 'false' } } } }))
	assert.equal((await config()).WebContent.behavior.contextMenuPopup.value, 'false')
	assert.deepEqual(b.errors, [])
})

test('the new tab page can still do everything: edit any note, patch many, delete, create notebooks, change settings', async () => {
	await seed()
	await b.openPage(`chrome-extension://${EXT_ID}/notate.html`)
	await asNewTab(op('PATCH_DATABASE', 'notate', 'NOTES', { title: 'Moved', origin: 'other.example/' }, 3))
	assert.equal((await notes()).find((n) => n.id === 3).origin, 'other.example/')
	await asNewTab(op('PATCH_DATABASE', 'notate', 'NOTES', { $each: [{ id: 4, data: { title: 'A' } }, { id: 5, data: { title: 'B' } }] }))
	assert.deepEqual((await notes()).filter((n) => n.id > 3).map((n) => n.title), ['A', 'B'])
	await asNewTab(op('POST_DATABASE', 'notate', 'NOTEBOOKS', { id: 2, title: 'Second', description: '', collection: [], created: now(), modified: now() }))
	await asNewTab(op('PATCH_DATABASE', 'notate', 'NOTEBOOKS', { collection: { $add: [4], $remove: [3] } }, 1))
	assert.deepEqual((await notebooks()).find((n) => n.id === 1).collection, [4])
	await asNewTab(op('PATCH_DATABASE', 'userConfiguration', 'USER_CONFIGURATION', { Notate: { search: { preferredEngine: { value: 'bing' } } } }))
	assert.equal((await config()).Notate.search.preferredEngine.value, 'bing')
	await asNewTab(op('DELETE_DATABASE', 'notate', 'NOTES', { id: 5 }))
	await asNewTab(op('DELETE_DATABASE', 'notate', 'NOTEBOOKS', { id: 2 }))
	assert.equal((await notes()).some((n) => n.id === 5), false)
	assert.equal((await notebooks()).some((n) => n.id === 2), false)
	assert.deepEqual(b.errors, [])
})

// ---- The content script does not believe events a web page made, and a web page does not see what is typed ----

const pageSees = (page, types) => page.eval(`(() => { window.__seen = []; for (const t of ${JSON.stringify(types)}) document.addEventListener(t, (e) => window.__seen.push(t)); return true })()`)
const openEditor = async () => {
	const { page, c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.appear('#edit-title')
	return { page, c }
}
const editorText = (page) => page.eval(`${CONTENT_ROOT}.querySelector('#input-text-display').textContent`, 'content')

test('a scripted click cannot open the note editor from the menu', async () => {
	const { c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.appear('#new-note-btn')
	await c.scriptedClick('#new-note-btn')
	await sleep(800)
	assert.equal(await c.exists('#edit-title'), false, 'no editor opened')
	await c.click('#new-note-btn')
	await c.appear('#edit-title')
})

test('scripted keys, pastes and drops cannot write into the page editor', async () => {
	const { page, c } = await openEditor()
	await c.fill('#input-text-display', 'typed')
	const send = (code) => page.eval(`(() => { const ed = ${CONTENT_ROOT}.querySelector('#input-text-display'); ed.focus(); ${code} })()`, 'content')
	await send(`ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))`)
	await send(`const dt = new DataTransfer(); dt.setData('text/plain', ' pasted'); ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))`)
	await send(`const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(70)], 'a.gif', { type: 'image/gif' })); ed.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))`)
	await sleep(800)
	assert.equal(await editorText(page), 'typed')
	assert.equal(await page.eval(`${CONTENT_ROOT}.querySelectorAll('#input-text-display img').length`, 'content'), 0)
	await page.type(' real')
	assert.equal(await editorText(page), 'typed real', 'real typing still works')
})

test('a scripted click on the page does not close the open menu or modal', async () => {
	await seed()
	const { page, c } = await openFixture(b, fx)
	await openContextMenu(c)
	const open = () => page.eval(`!${CONTENT_ROOT}.querySelector('#context-menu').className.includes('pointer-events-none')`, 'content')
	assert.equal(await open(), true)
	await page.eval(`document.body.click(); document.documentElement.click()`)
	await sleep(500)
	assert.equal(await open(), true, 'the menu stays open')

	await c.click('#context-item-add-to-notebook')
	await c.appear('#add-to-notebook-bottombar')
	await page.eval(`document.body.click(); document.querySelector('h1').click()`)
	await sleep(800)
	assert.equal(await c.exists('#add-to-notebook-bottombar'), true, 'the modal stays open')
	await page.click(20, 450) // a real click on the page, outside our UI
	await c.gone('#add-to-notebook-bottombar')
})

test('a page element that carries our id does not count as part of the menu or modal', async () => {
	await seed()
	const { page, c } = await openFixture(b, fx)
	await page.eval(`(() => { const d = document.createElement('div'); d.id = 'content-script-entry-point'; d.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;background:red;z-index:1'; document.body.append(d) })()`)
	await openContextMenu(c)
	await c.click('#context-item-add-to-notebook')
	await c.appear('#add-to-notebook-bottombar')
	await page.click(100, 100)
	await c.gone('#add-to-notebook-bottombar')
	await openContextMenu(c)
	await page.click(100, 100)
	await waitFor(() => page.eval(`${CONTENT_ROOT}.querySelector('#context-menu').className.includes('pointer-events-none')`, 'content'), 'menu closes on a click on the decoy')
})

test('"Select All" in the page editor selects the editor, not a page element with the same id', async () => {
	const { page, c } = await openEditor()
	await page.eval(`(() => { const d = document.createElement('div'); d.id = 'input-text-display'; d.textContent = 'decoy'; document.body.append(d) })()`)
	await c.fill('#input-text-display', 'mine')
	const { x, y } = await c.center('#input-text-display')
	await page.rightClick(x, y)
	await c.click('#selectAll')
	assert.equal(await page.eval(`window.getSelection().toString()`, 'content'), 'mine')
})

test('what is typed in the page editor and its title does not reach the web page', async () => {
	const { page, c } = await openEditor()
	await pageSees(page, ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'cut', 'copy'])
	await c.fill('#edit-title', 'secret title')
	await c.fill('#input-text-display', 'secret body')
	for (const key of ['a', 'Backspace']) {
		await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, text: key === 'a' ? 'a' : undefined })
		await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key })
	}
	await sleep(300)
	assert.deepEqual(await page.eval(`window.__seen`), [], 'the page heard nothing')
	assert.match(await editorText(page), /^secret body/, 'the editor still got it all')
})

test('in-page create, edit, Notes From This Site and Add to Notebook still work together', async () => {
	await seed()
	const { page, c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.appear('#context-item-page-notes')
	assert.match(await c.text(), /Notes From This Site \(2\)/)
	await c.click('#context-item-page-notes')
	await c.appear('#page-notes-modal #related-note-title')
	assert.deepEqual(await page.eval(`[...${CONTENT_ROOT}.querySelectorAll('#page-notes-list [id="related-note-title"]')].map((e) => e.textContent)`, 'content'), ['Here', 'Here too'])
	await c.hover('#related-note-heading-1')
	await c.click('#related-note-heading-1')
	await c.appear('#edit-title')
	await c.fill('#edit-title', ' edited')
	await c.click('#save-note-btn')
	await waitFor(async () => /edited/.test((await notes()).find((n) => n.id === 1)?.title), 'edit saved')

	await openContextMenu(c)
	await c.click('#context-item-add-to-notebook')
	await c.appear('#notebook-card-1')
	assert.equal(await c.exists('#related-note-heading-3'), false)
	await dragAndDrop(b, page, await c.center('#related-note-heading-1'), await c.center('#notebook-card-1'))
	await c.click('#add-to-notebook-bottombar #save-btn')
	await waitFor(async () => (await notebooks())[0].collection.includes(1), 'note filed')
	assert.deepEqual((await notebooks())[0].collection.sort(), [1, 3], 'what was already filed stays')
	assert.deepEqual(b.errors, [])
})
