import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, ui, waitFor, sleep, EXT_ID } from './helper.mjs'

const NEWTAB = `chrome-extension://${EXT_ID}/notate.html`
let b

beforeEach(async () => { b = await launch() })
afterEach(async () => { await b.close() })

const manifestVersion = async () => (await b.reader()).eval('chrome.runtime.getManifest().version')
const storedSeen = async () => (await b.reader()).eval(`chrome.storage.local.get('lastSeenVersion').then((v) => v.lastSeenVersion ?? null)`)
const setSeen = async (v) => (await b.reader()).eval(`chrome.storage.local.set({ lastSeenVersion: ${JSON.stringify(v)} })`)
// A fresh profile runs the install handler once. Wait for it, so a test that then fakes an older state is not overwritten.
const afterInstall = async () => { const v = await manifestVersion(); await waitFor(async () => (await storedSeen()) === v, 'install handler'); return v }
const label = (page) => page.eval(`document.querySelector('#whats-new-widget')?.getAttribute('aria-label')`)

test('fresh install: the button is there and there is no red dot', async () => {
	const version = await afterInstall()
	assert.equal(await storedSeen(), version, 'a fresh install has seen the current version')
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#whats-new-widget')
	await sleep(600) // give the changelog time to load, so an absent dot is not just "not loaded yet"
	assert.equal(await n.exists('#whats-new-dot'), false)
	assert.equal(await label(page), "What's new")
	assert.deepEqual(b.errors, [])
})

test('after an update the red dot shows, opening the panel lists the releases and clears the dot', async () => {
	const version = await afterInstall()
	await setSeen('1.2.0') // the state of a user who updates from an older build
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.appear('#whats-new-dot')
	assert.equal(await label(page), "What's new (updated)")

	await n.click('#whats-new-widget')
	await n.appear('#whats-new-modal')
	const sections = await page.eval(`[...document.querySelectorAll('.whats-new-section')].map((s) => ({ v: s.dataset.version, isNew: s.dataset.new, bullets: s.querySelectorAll('li').length }))`)
	assert.deepEqual(sections.map((s) => s.v), ['1.2.1', '1.2.0'], 'newest first, released only')
	assert.deepEqual(sections.map((s) => s.isNew), ['true', 'false'], 'only the unseen release is marked')
	assert.ok(sections.every((s) => s.bullets > 0))
	const text = await n.text()
	assert.ok(text.includes('Safer note editor'), 'bullets are shown')
	assert.ok(text.includes('Security fixes for the note editor'), 'the blurb is shown')
	assert.ok(!/Unreleased|Movable Notate button/.test(text), 'Unreleased never ships')
	assert.ok(await page.eval(`!!document.querySelector('#whats-new-modal strong')`), 'bold phrases render as bold')

	assert.equal(await storedSeen(), version, 'opening stores the running version')
	await n.gone('#whats-new-dot')
	assert.equal(await label(page), "What's new")

	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
	await n.gone('#whats-new-modal')
	const again = await b.openPage(NEWTAB)
	await ui(again).appear('#whats-new-widget')
	await sleep(600)
	assert.equal(await ui(again).exists('#whats-new-dot'), false, 'still gone after a reload')
	assert.deepEqual(b.errors, [])
})

test('no dot when the seen version is current, or when nothing is stored', async () => {
	await afterInstall()
	await setSeen(null)
	await (await b.reader()).eval(`chrome.storage.local.remove('lastSeenVersion')`)
	const page = await b.openPage(NEWTAB)
	await ui(page).appear('#whats-new-widget')
	await sleep(600)
	assert.equal(await ui(page).exists('#whats-new-dot'), false)
})

test('the panel shows a short line when the release notes cannot be loaded', async () => {
	await afterInstall()
	await setSeen('1.2.0')
	const page = await b.openPage('about:blank')
	await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const f = window.fetch; window.fetch = (u, ...a) => String(u).endsWith('changelog.json') ? Promise.resolve(new Response('not json')) : f(u, ...a) })()` })
	await page.send('Page.navigate', { url: NEWTAB })
	const n = ui(page)
	await n.appear('#whats-new-widget')
	await n.click('#whats-new-widget')
	await n.appear('#whats-new-fallback')
	assert.equal(await n.exists('#whats-new-dot'), false, 'no dot without notes')
})

test('the button sits next to Settings in the grid layout and in the board layout', async () => {
	await afterInstall()
	const grid = await b.openPage(NEWTAB)
	const g = ui(grid)
	await g.appear('#whats-new-widget')
	await g.appear('#settings-widget')
	assert.ok(await grid.eval(`document.querySelector('#whats-new-widget').nextElementSibling === document.querySelector('#settings-widget')`), 'grid: side by side')

	await waitFor(async () => (await b.idb()).USER_CONFIGURATION_DB?.USER_CONFIGURATION?.[0], 'seeded config')
	await b.request('PATCH_DATABASE', { database: 'userConfiguration', store: 'USER_CONFIGURATION', data: { Notate: { page: { boardLayout: { value: 'true' } } } } })
	const board = await b.openPage(NEWTAB)
	const n = ui(board)
	await n.appear('#board')
	await n.appear('#whats-new-widget')
	assert.ok(await board.eval(`!!document.querySelector('#board-settings-slot #whats-new-widget') && document.querySelector('#whats-new-widget').nextElementSibling === document.querySelector('#settings-widget')`), 'board: in the header slot, beside Settings')
	await n.click('#whats-new-widget')
	await n.appear('#whats-new-modal')
	await n.click('#whats-new-close')
	await n.gone('#whats-new-modal')
})
