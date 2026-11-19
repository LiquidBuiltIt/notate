import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, startFixture, openFixture, openContextMenu, ui, waitFor, sleep, EXT_ID } from './helper.mjs'

const NEWTAB = `chrome-extension://${EXT_ID}/notate.html`
const PAGE_EDITOR = `chrome.dom.openOrClosedShadowRoot(document.querySelector("#content-script-entry-point")).querySelector('#input-text-display')`
let b, fx
beforeEach(async () => { fx = await startFixture(); b = await launch() })
afterEach(async () => { await b.close(); fx.close() })

const notes = async () => (await b.idb()).NOTATE_DB?.NOTES ?? []

// The same editor runs on the new tab page and in the page; every typing test runs in both.
const drivers = {
	'new tab': async () => {
		const page = await b.openPage(NEWTAB)
		const n = ui(page)
		await n.hover('#search-bar-tab')
		await n.click('#new-note-button')
		await n.fill('#edit-note-title', 'Md')
		await n.appear('#input-text-display')
		const ed = `document.querySelector('#input-text-display')`
		await page.eval(`${ed}.focus()`)
		return { page, ed, world: undefined, save: () => n.click('#save-btn') }
	},
	'page editor': async () => {
		const { page, c } = await openFixture(b, fx)
		await openContextMenu(c)
		await c.click('#new-note-btn')
		await c.fill('#edit-title', 'Md')
		await c.appear('#input-text-display')
		await page.eval(`${PAGE_EDITOR}.focus()`, 'content')
		return { page, ed: PAGE_EDITOR, world: 'content', save: () => c.click('#save-note-btn') }
	},
}

const KEYS = { Enter: { key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 }, Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, Space: { key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 }, z: { key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 } }
const press = async (d, name, modifiers = 0) => {
	const { text, ...up } = KEYS[name]
	await d.page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...KEYS[name], modifiers, ...(modifiers ? { text: undefined } : {}) })
	await d.page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...up, modifiers })
}
const CTRL = 2, SHIFT = 8
// One character at a time, so each one fires its own input event like real typing.
const type = async (d, text) => { for (const ch of text) await (ch === ' ' ? press(d, 'Space') : d.page.type(ch)) }
const line = async (d, text) => { await type(d, text); await press(d, 'Enter') }
const html = async (d) => (await d.page.eval(`${d.ed}.innerHTML`, d.world)).replace(/ style="[^"]*"/g, '').replace(/​/g, '').replace(/&nbsp;/g, ' ')
const saved = async (d) => { await d.save(); return (await waitFor(async () => { const n = await notes(); return n.length && n }, 'saved note'))[0] }

for (const [where, open] of Object.entries(drivers)) {
	test(`${where}: typing a closing marker turns **bold**, *italic*, ~~strike~~, ==mark==, code and a link into formats, and typing goes on outside them`, async () => {
		const d = await open()
		await type(d, 'x **bold** y *it* z ~~gone~~ ==hi== `c` [a](https://example.test/p) w')
		assert.equal(await html(d), 'x <b>bold</b> y <i>it</i> z <s>gone</s> <mark>hi</mark> <code>c</code> <a href="https://example.test/p">a</a> w')
		assert.deepEqual(b.errors, [])
	})

	test(`${where}: a javascript: link stays text, an https link next to it becomes a link`, async () => {
		const d = await open()
		await type(d, '[bad](javascript:alert(1)) [ok](https://example.test/)')
		const hrefs = await d.page.eval(`[...${d.ed}.querySelectorAll('a')].map((a) => a.getAttribute('href'))`, d.world)
		assert.deepEqual(hrefs, ['https://example.test/'])
		assert.match(await html(d), /\[bad\]\(javascript:alert\(1\)\)/)
	})

	test(`${where}: Ctrl+Z right after a conversion puts the typed text back, and the stored note has no hidden marker characters`, async () => {
		const d = await open()
		await type(d, '**bold**')
		assert.equal(await html(d), '<b>bold</b>')
		await press(d, 'z', CTRL)
		assert.equal(await html(d), '**bold**')
		await press(d, 'z', CTRL) // a second undo must not break anything
		await d.page.eval(`${d.ed}.focus()`, d.world)
		await type(d, ' and **more**')
		const note = await saved(d)
		assert.doesNotMatch(note.content, /​/)
		assert.match(note.content, /<b[^>]*>more<\/b>/)
	})

	test(`${where}: a marker with the wrong run length, or inside code, is not converted`, async () => {
		const d = await open()
		await type(d, '2 * 3 * 4 and **bold* and snake_case_word')
		assert.doesNotMatch(await html(d), /<i>|<b>/)
		await line(d, '')
		await line(d, '```')
		await type(d, '**not bold**')
		assert.match(await html(d), /<pre><code>\*\*not bold\*\*/)
		assert.doesNotMatch(await html(d), /<b>/)
	})

	test(`${where}: ### to ###### make headings, and --- with Enter makes a rule`, async () => {
		const d = await open()
		await line(d, 'text')
		await line(d, '---')
		await line(d, 'after')
		await type(d, '###'); await press(d, 'Space'); await line(d, 'Three')
		await type(d, '######'); await press(d, 'Space'); await type(d, 'Six')
		const h = await html(d)
		assert.match(h, /<h3>Three<\/h3>/)
		assert.match(h, /<h6>Six<\/h6>/)
		assert.match(h, /<hr>/)
		assert.match(h, /after/)
		assert.ok(h.indexOf('<hr>') < h.indexOf('after'), 'the rule comes before the text typed after it')
		assert.ok(h.indexOf('text') < h.indexOf('<hr>'))
	})

	test(`${where}: a fenced code block takes Enter and Tab as text, shows no formats, and Enter on an empty last line leaves it`, async () => {
		const d = await open()
		await line(d, '```js')
		await line(d, 'a')
		await press(d, 'Tab'); await type(d, 'b')
		await press(d, 'Enter'); await press(d, 'Enter')
		await type(d, 'out')
		assert.equal(await html(d), '<pre data-lang="js"><code>a<br>  b</code></pre><div>out</div>')
	})

	test(`${where}: Arrow-down at the end of a code block leaves it`, async () => {
		const d = await open()
		await line(d, '```')
		await type(d, 'x')
		await press(d, 'ArrowDown')
		await type(d, 'z')
		assert.equal(await html(d), '<pre><code>x</code></pre><div>z</div>')
	})

	test(`${where}: Tab and Shift+Tab nest and unnest list items, checklists too`, async () => {
		const d = await open()
		await type(d, '-'); await press(d, 'Space'); await line(d, 'a')
		await type(d, 'b'); await press(d, 'Tab')
		assert.equal(await html(d), '<ul><li>a</li><ul><li>b</li></ul></ul>')
		await press(d, 'Tab', SHIFT)
		assert.equal((await html(d)).replace(/<\/?span>/g, ''), '<ul><li>a</li><li>b</li></ul>') // the browser may wrap the moved text in a span
		await press(d, 'Tab')
		await type(d, '!')
		const note = await saved(d)
		assert.doesNotMatch(note.content, /\t/)
	})

	test(`${where}: a typed header row with Enter makes a table, Tab walks the cells and adds a row`, async () => {
		const d = await open()
		await line(d, '| a | b |')
		await type(d, '1'); await press(d, 'Tab'); await type(d, '2'); await press(d, 'Tab'); await type(d, '3'); await press(d, 'Tab'); await type(d, '4')
		const rows = await d.page.eval(`[...${d.ed}.querySelectorAll('tr')].map((r) => [...r.children].map((c) => c.localName + ':' + c.textContent))`, d.world)
		assert.deepEqual(rows, [['th:a', 'th:b'], ['td:1', 'td:2'], ['td:3', 'td:4']])
		await press(d, 'Tab', SHIFT); await type(d, '!')
		assert.match(await html(d), /<td>3!<\/td>/)
	})

	test(`${where}: > [!tip] Title with Enter makes a callout`, async () => {
		const d = await open()
		await type(d, '>'); await press(d, 'Space'); await line(d, '[!tip] Hi')
		await type(d, 'body')
		assert.equal(await html(d), '<blockquote data-callout="tip"><div>Hi</div><div>body</div></blockquote>')
	})

	test(`${where}: [^1]: with a space starts a footnote definition, and a typed [^1] after text is a reference`, async () => {
		const d = await open()
		await type(d, 'claim[^1]'); await line(d, '')
		await type(d, '[^1]:'); await press(d, 'Space'); await type(d, 'source')
		const h = await html(d)
		assert.match(h, /claim<sup data-fn="1">1<\/sup>/)
		assert.match(h, /<div data-fn-def="1">source<\/div>/)
	})

	test(`${where}: typed [[Note]], [[Note|alias]], #tag and %%comment%% become elements`, async () => {
		const d = await open()
		await type(d, 'see [[Trip plan]] and [[Trip plan|the plan]] #travel/2026 now %%hide%%')
		const h = await html(d)
		assert.match(h, /<span data-note-link="Trip plan">Trip plan<\/span>/)
		assert.match(h, /<span data-note-link="Trip plan">the plan<\/span>/)
		assert.match(h, /<span data-tag="travel\/2026">#travel\/2026<\/span> now/)
		assert.match(h, /<span data-comment="">hide<\/span>/)
		const not = await open()
		await type(not, 'issue #123 is not a tag')
		assert.doesNotMatch(await html(not), /data-tag/)
	})
}

// ---- Paste (new tab only: the page editor ignores scripted events, so a real paste cannot be driven there) ----
const paste = (d, text) => d.page.eval(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', ${JSON.stringify(text)}); ${d.ed}.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })()`)
const MD = '# Plan\n\nA **bold** step with a [link](https://example.test/) and `code`.\n\n- one\n- two\n\n| x | y |\n| - | - |\n| 1 | 2 |\n\n> [!warning] Heads up\n> mind the gap\n'

test('new tab: pasted Markdown becomes formats, and Ctrl+Shift+V pastes it as text', async () => {
	const d = await drivers['new tab']()
	await paste(d, MD)
	await sleep(200)
	const tags = await d.page.eval(`[...${d.ed}.querySelectorAll('*')].map((e) => e.localName)`)
	for (const t of ['h1', 'b', 'a', 'code', 'ul', 'li', 'table', 'th', 'td', 'blockquote']) assert.ok(tags.includes(t), `${t} in ${tags}`)
	assert.equal(await d.page.eval(`${d.ed}.querySelector('blockquote').dataset.callout`), 'warning')
	// plain paste
	const d2 = await drivers['new tab']()
	await d2.page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'V', code: 'KeyV', modifiers: CTRL | SHIFT, windowsVirtualKeyCode: 86 })
	await paste(d2, MD)
	await d2.page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'V', code: 'KeyV', modifiers: CTRL | SHIFT, windowsVirtualKeyCode: 86 })
	await sleep(200)
	assert.equal(await d2.page.eval(`${d2.ed}.querySelectorAll('h1, b, table').length`), 0)
	assert.match(await d2.page.eval(`${d2.ed}.textContent`), /# Plan/)
})

test('new tab: pasted Markdown with raw HTML and unsafe links brings text only', async () => {
	const d = await drivers['new tab']()
	await paste(d, '# Title\n\n<img src=x onerror="window.__pwn=1"> <script>window.__pwn=2</script>\n\n[bad](javascript:window.__pwn=3) [ok](https://example.test/)\n\n![i](https://127.0.0.1:1/beacon.png)')
	await sleep(500)
	assert.equal(await d.page.eval(`${d.ed}.querySelectorAll('img, script').length`), 0)
	assert.equal(await d.page.eval(`window.__pwn`), undefined)
	assert.deepEqual(await d.page.eval(`[...${d.ed}.querySelectorAll('a')].map((a) => a.getAttribute('href'))`), ['https://example.test/', 'https://127.0.0.1:1/beacon.png'], 'a remote picture is a plain link, never loaded')
	assert.match(await d.page.eval(`${d.ed}.textContent`), /<img src=x/)
})

test('new tab: a paste of plain prose stays plain text', async () => {
	const d = await drivers['new tab']()
	await paste(d, 'Call me at 3 * 4 pm, or maybe not.')
	assert.equal(await html(d), 'Call me at 3 * 4 pm, or maybe not.')
})
