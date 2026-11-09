import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

test('scripted clicks cannot reveal the related notes, pick a view, or open a note', async () => {
	const { c } = await openFixture(b, fx)
	await openContextMenu(c)
	await c.click('#new-note-btn')
	await c.fill('#edit-title', 'Related')
	await c.fill('#input-text-display', 'body')
	await c.click('#save-note-btn')
	await waitFor(async () => (await notes()).length === 1, 'note saved')
	// A fresh tab: the related notes are loaded from the saved note.
	const { c: c2 } = await openFixture(b, fx)
	await c2.appear('#reveal-related-notes-btn')

	await c2.scriptedClick('#reveal-related-notes-btn')
	await sleep(500)
	assert.equal(await c2.exists('#related-notes-navigation'), false, 'scripted click did not reveal')
	await c2.hover('#related-notes-hover-region')
	await c2.click('#reveal-related-notes-btn')
	await c2.appear('#related-notes-navigation')

	await c2.scriptedClick('#cycle-forwards-btn')
	await sleep(500)
	assert.match(await c2.text(), /Related By URL View/, 'scripted click did not change the view')
	await c2.click('#cycle-forwards-btn')
	await waitFor(async () => (await c2.text()).includes("Suggestion View"), 'real click changes the view')
	await c2.click('#cycle-backwards-btn')
	await waitFor(async () => (await c2.text()).includes('Related By URL View'), 'back to URL view')

	await c2.appear('#related-note-title')
	await c2.scriptedClick('[id^="related-note-heading-"]')
	await sleep(800)
	assert.equal(await c2.exists('#edit-title'), false, 'scripted click did not open the note')
	await c2.hover('#related-note-title')
	await c2.click('#related-note-title')
	await c2.appear('#edit-title')
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
	const key = { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 }
	await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key })
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key })
	await waitFor(async () => /<font [^>]*size="6"[^>]*>before/.test(await editorHtml(page)), 'text resized to 6')
	await c.click('#save-note-btn')
	const [saved] = await waitFor(async () => { const n = await notes(); return n.length && n }, 'note in IndexedDB')
	assert.match(saved.content, /<font [^>]*size="6"[^>]*>before/)
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
	const closeBtn = '#editor-window-ctrl-center > svg:last-child'
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
		await page.eval(`window.__root = null; document.execCommand('insertHTML', false, ${JSON.stringify(html)})`)
		await sleep(400)
		reached[name] = await page.eval(`window.__root instanceof ShadowRoot`)
	}
	assert.deepEqual(reached, Object.fromEntries(Object.keys(payloads).map((k) => [k, false])))
	await assertHeld(page, c, 'handlers')
})
