import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, startFixture, ui, waitFor, sleep, EXT_ID } from './helper.mjs'

const NEWTAB = `chrome-extension://${EXT_ID}/notate.html`
let b, fx
beforeEach(async () => { fx = await startFixture(); b = await launch() })
afterEach(async () => { await b.close(); fx.close() })

const notes = async () => (await b.idb()).NOTATE_DB?.NOTES ?? []

// Opens Settings and hands the files to the Import Markdown input like a file picker would.
async function importFiles(files) {
	const page = await b.openPage(NEWTAB)
	const n = ui(page)
	await n.click('#settings-widget')
	await n.appear('#import-markdown-button')
	await n.center('#save-settings-button')
	await page.eval(`(() => {
		const dt = new DataTransfer()
		for (const f of ${files}) dt.items.add(f)
		const input = document.querySelector('#import-markdown-input')
		input.files = dt.files
		input.dispatchEvent(new Event('change', { bubbles: true }))
	})()`)
	return page
}
const file = (name, text, type = 'text/markdown') => `new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} })`

test('Import Markdown: title from front matter, then the first H1, then the file name; color, no origin, safe content', async () => {
	await importFiles(`[
		${file('one.md', '---\ntitle: "From front matter"\ncolor: "yellow"\n---\n\n# Heading stays\n\nSome **bold** words, [ok](https://example.test/) and [bad](javascript:alert(1)).\n')},
		${file('two.md', '# Trip plan\n\n- pack\n- go\n\n<img src=x onerror="window.__pwn=1"> raw html is text\n')},
		${file('Third note.markdown', 'only a paragraph\n', '')},
	]`)
	const all = await waitFor(async () => { const n = await notes(); return n.length === 3 && n }, 'three imported notes')
	const by = (t) => all.find((x) => x.title === t)
	const one = by('From front matter'), two = by('Trip plan'), three = by('Third note')
	assert.ok(one && two && three, JSON.stringify(all.map((x) => x.title)))
	assert.equal(one.color?.name, 'yellow')
	assert.ok(one.color.styles?.card, 'the stored color has its styles')
	assert.match(one.content, /<h1[^>]*>Heading stays<\/h1>/, 'with a front matter title the H1 stays in the note')
	assert.match(one.content, /<b[^>]*>bold<\/b>/)
	assert.match(one.content, /href="https:\/\/example.test\/"/)
	assert.doesNotMatch(one.content, /javascript:[^<]*<\/a>|href="javascript/)
	assert.doesNotMatch(two.content, /<h1/, 'the H1 that became the title is not repeated in the body')
	assert.match(two.content, /<li[^>]*>pack<\/li>/)
	assert.doesNotMatch(two.content, /<img/)
	assert.match(two.content, /&lt;img src=x/)
	for (const x of all) assert.ok(!x.origin, `no origin: ${x.title}`)
	assert.deepEqual(b.errors, [])
})

test('Import Markdown: non-text files, NUL bytes, invalid UTF-8 and oversized files are skipped, the good file still imports', async () => {
	await importFiles(`[
		new File([new Uint8Array([137, 80, 78, 71])], 'pic.png', { type: 'image/png' }),
		new File(['a'], 'note.md', { type: 'application/octet-stream' }),
		${file('nul.md', 'bad\u0000text')},
		new File([new Uint8Array([0xff, 0xfe, 0x41])], 'latin.md', { type: 'text/markdown' }),
		${file('huge.md', 'word '.repeat(250000))},
		${file('good.md', '# Good\n\nfine\n')},
	]`)
	await waitFor(async () => (await notes()).length >= 1, 'the good note')
	await sleep(1500)
	assert.deepEqual((await notes()).map((x) => x.title), ['Good'])
})
