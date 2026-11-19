// Parser, exporter, sanitizer and card text, run as the real ES modules in Chromium (no build needed).
// MD_SRC points the harness at another copy of src/, to show a test failing on old code.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launch } from './helper.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(process.env.MD_SRC ?? join(here, '../../../src'))
const PAGE = `<!doctype html><title>md</title><script type="module">
const load = (p) => import(p).catch(() => ({}))
const [fmt, md, parser, plain, imp] = await Promise.all([
	load('/src/Universal/Components/TextEditor/Components/TextInput/InputFormatters.js'), load('/src/Universal/Utils/markdown.js'),
	load('/src/Universal/Utils/mdParse.js'), load('/src/Universal/Utils/plainText.js'), load('/src/Notate/importNotes.js')])
window.M = { sanitize: fmt.sanitizeHtml, toMarkdown: md.toMarkdown, parse: parser.parseMarkdown, inline: parser.parseInline, looks: parser.looksLikeMarkdown, plain: plain.default, MAX: parser.MAX_MD, readFiles: imp.readMarkdownFiles, noteFrom: imp.noteFromMarkdown, FILE: imp.MAX_FILE, TOTAL: imp.MAX_TOTAL, FILES: imp.MAX_FILES,
	time(fn) { const t = performance.now(); const r = fn(); return { ms: performance.now() - t, len: String(r?.html ?? r).length } } }
window.ready = true
</script>`

let server, b, page
before(async () => {
	server = createServer((req, res) => {
		if (req.url === '/') { res.setHeader('content-type', 'text/html'); return res.end(PAGE) }
		const file = join(SRC, req.url.replace(/^\/src\//, ''))
		if (!file.startsWith(SRC) || !existsSync(file)) { res.statusCode = 404; return res.end('no') }
		res.setHeader('content-type', 'text/javascript')
		res.end(readFileSync(file, 'utf8').replace(/from '@universal\//g, "from '/src/Universal/").replace(/from '@notate\//g, "from '/src/Notate/"))
	})
	await new Promise((r) => server.listen(0, '127.0.0.1', r))
	b = await launch()
	page = await b.openPage(`http://127.0.0.1:${server.address().port}/`)
	for (let i = 0; i < 50 && !(await page.eval('window.ready === true')); i++) await new Promise((r) => setTimeout(r, 100))
})
after(async () => { await b.close(); server.close() })

const call = (expr) => page.eval(expr)
const parse = (md, opts = {}) => call(`M.parse(${JSON.stringify(md)}, ${JSON.stringify(opts)})`)
const toMd = (html) => call(`M.toMarkdown(${JSON.stringify(html)})`)
const round = async (md) => toMd((await parse(md)).html)

// Markdown in the form our own export writes. Parse it, write it back: the same text, and again the same.
const CORPUS = {
	'inline marks': 'plain **bold** and *italic* and ~~gone~~ and ==marked== and `code` and [the site](https://example.com/a?b=1).',
	'bold and italic together': 'a ***both*** b and **bold with *italic* inside** end',
	'headings 1 to 6': '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six',
	'horizontal rule': 'before\n\n---\n\nafter',
	'nested lists': '- a\n  - b\n    - c\n- d',
	'ordered list': '1. one\n2. two\n   1. inner\n3. three',
	'checklist': '- [ ] todo\n- [x] done\n  - [ ] sub task',
	'code block with language': '```js\nconst a = 1\n\nif (a) {\n  b()\n}\n```',
	'code block without language': '```\nplain text\n  indented\n```',
	'code block containing a fence': '````\n```\nx\n````',
	'callout with title': '> [!warning] Check the lock\n> Bolt it twice.',
	'callout without title': '> [!note]\n> just the body',
	'callout with two blocks': '> [!tip] Two parts\n> first part\n>\n> second part',
	'plain quote': '> a single line quote',
	'table': '| Tool | Qty |\n| --- | --- |\n| hammer | 2 |\n| **saw** | a \\| b |',
	'note links': 'See [[Garden plan]] and [[Garden plan|the plan]].',
	'tags': 'Filed under #project/alpha and #todo, plus #2024-plan.',
	'footnote': 'The claim[^1] holds.\n\n[^1]: Source: the 2024 survey.',
	'comment': 'visible %%not for cards%% visible',
	'image': '![](data:image/png;base64,iVBORw0KGgo=)',
	'escapes': 'not \\*bold\\* and \\#tag and \\[\\[x\\]\\] and a \\=\\= b and 50% of 5\\%\\%',
	'code with backticks': '`` `a` ``',
}
for (const [name, md] of Object.entries(CORPUS)) {
	test(`round trip: ${name}`, async () => {
		const once = await round(md)
		assert.equal(once, md)
		assert.equal(await round(once), md, 'stable on a second pass')
	})
}

test('round trip: shapes the parser produces from loose Markdown', async () => {
	assert.equal(await round('Some _italic_ and __bold__ text\n* star item\n+ plus item'), 'Some *italic* and **bold** text\n\n- star item\n- plus item')
})

test('front matter: title and color are read, the body is the same as without it', async () => {
	const fm = '---\nid: 7\ntitle: "Garden: plan"\ncolor: "green"\ncreated: "2026-01-02T03:04:05.000Z"\n---\n\n# Heading\n\ntext'
	const r = await parse(fm, { front: true })
	assert.equal(r.meta.title, 'Garden: plan')
	assert.equal(r.meta.color, 'green')
	assert.equal(r.meta.id, '7')
	assert.equal(r.html, (await parse('# Heading\n\ntext')).html)
	assert.match((await parse(fm)).html, /Garden: plan/, 'without the option it stays text')
})

test('the plain formats become the elements the editor stores', async () => {
	const h = (await parse('# T\n\n**b** *i* ~~s~~ ==m== `c` [l](https://x.test/)')).html
	assert.equal(h, '<h1>T</h1><div><b>b</b> <i>i</i> <s>s</s> <mark>m</mark> <code>c</code> <a href="https://x.test/">l</a></div>')
	const t = (await parse('| a | b |\n| - | - |\n| 1 | 2 |')).html
	assert.equal(t, '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>')
	assert.equal((await parse('```Rust\nx\n```')).html, '<pre data-lang="rust"><code>x</code></pre>')
	assert.equal((await parse('> [!bug] Crash\n> body')).html, '<blockquote data-callout="bug"><div>Crash</div><div>body</div></blockquote>')
	assert.equal((await parse('a [[B|c]] #t')).html, '<div>a <span data-note-link="B">c</span> <span data-tag="t">#t</span></div>')
	assert.equal((await parse('x[^n]\n\n[^n]: def')).html, '<div>x<sup data-fn="n">n</sup></div><div data-fn-def="n">def</div>')
})

test('security: only http and https links; raw HTML stays text', async () => {
	const ok = (await parse('[ok](https://example.com/p)')).html
	assert.match(ok, /<a href="https:\/\/example\.com\/p">ok<\/a>/)
	for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'file:///etc/passwd', '//evil.example/x', ' javascript:alert(1)', 'java\tscript:alert(1)', 'ftp://x.test/f']) {
		const h = (await parse(`[click](${bad})`)).html
		assert.ok(!/<a[\s>]/.test(h), `link kept for ${bad}: ${h}`)
		assert.match(h, /click/)
	}
	for (const raw of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '<a href="javascript:alert(1)">x</a>', '<svg onload=alert(1)>', '<b onclick=x>t</b>', '&lt;b&gt;']) {
		const h = (await parse(raw)).html
		assert.ok(!/<(img|script|svg|a|b)[\s>]/i.test(h), `markup made from ${raw}: ${h}`)
		const text = await call(`(() => { const d = document.createElement('div'); d.innerHTML = ${JSON.stringify(h)}; return d.textContent })()`)
		assert.equal(text, raw, 'the raw text is shown as typed')
	}
	assert.match((await parse('![x](https://evil.test/p.png) ![y](data:image/svg+xml;base64,PHN2Zz4=)')).html, /^(?!.*<img)/, 'only data:image (not svg) pictures')
})

test('security: values from the text cannot add attributes, tags or types', async () => {
	const check = async (md) => call(`(() => { const d = document.createElement('div'); d.innerHTML = ${JSON.stringify((await parse(md)).html)}
		return [...d.querySelectorAll('*')].map((e) => e.localName + ':' + [...e.attributes].map((a) => a.name).join(',')) })()`)
	assert.deepEqual(await check('[[a" onmouseover="x]]'), ['div:', 'span:data-note-link'])
	assert.deepEqual(await check('```js" onclick="x\ncode\n```'), ['pre:', 'code:'])
	assert.deepEqual(await check('> [!script] t\n> b'), ['blockquote:', 'div:', 'br:'])
	assert.deepEqual(await check('[^a" x="y]'), ['div:'])
	assert.deepEqual(await check('#tag" onclick="x'), ['div:', 'span:data-tag'])
	assert.deepEqual(await check('[a](https://x.test/" onclick="y)'), ['div:'])
	assert.deepEqual(await check('[a b](https://x.test/p "title")'), ['div:', 'a:href'])
})

test('security: the sanitizer allows only the new tags and exact attribute values', async () => {
	const s = (html) => call(`M.sanitize(${JSON.stringify(html)})`)
	assert.equal(await s('<hr><mark>m</mark><code>c</code><h3>x</h3><sup data-fn="a-1">1</sup><table><thead><tr><th>h</th></tr></thead><tbody><tr><td>d</td></tr></tbody></table>'),
		'<hr><mark>m</mark><code>c</code><h3>x</h3><sup data-fn="a-1">1</sup><table><thead><tr><th>h</th></tr></thead><tbody><tr><td>d</td></tr></tbody></table>')
	assert.equal(await s('<pre data-lang="c++"><code>x</code></pre>'), '<pre data-lang="c++"><code>x</code></pre>')
	assert.equal(await s('<pre data-lang="a b" onclick="x"><code>x</code></pre>'), '<pre><code>x</code></pre>')
	assert.equal(await s('<pre data-lang="' + 'a'.repeat(21) + '">x</pre>'), '<pre>x</pre>')
	assert.equal(await s('<blockquote data-callout="note">x</blockquote><blockquote data-callout="evil">y</blockquote>'), '<blockquote data-callout="note">x</blockquote><blockquote>y</blockquote>')
	assert.equal(await s('<span data-tag="a/b-c_1">x</span><span data-tag="123">y</span><span data-tag="a b">z</span>'), '<span data-tag="a/b-c_1">x</span><span>y</span><span>z</span>')
	assert.equal(await s('<span data-note-link="Some note">x</span><span data-note-link="a|b">y</span><span data-note-link="' + 'n'.repeat(201) + '">z</span>'), '<span data-note-link="Some note">x</span><span>y</span><span>z</span>')
	assert.equal(await s('<a data-note-link="x" href="javascript:1">x</a><span data-note-link="x" href="https://a.test/">y</span>'), '<a>x</a><span data-note-link="x">y</span>')
	assert.equal(await s('<div data-fn-def="a b">x</div><div data-fn-def="n1">y</div><td onclick="x">z</td><span data-comment="x">c</span><span data-comment="">d</span>'), '<div>x</div><div data-fn-def="n1">y</div>z<span>c</span><span data-comment="">d</span>')
	assert.equal(await s('<script>1</script><iframe></iframe><style>x{}</style><pre>a</pre>'), '<pre>a</pre>')
})

test('security: pathological input finishes fast', async () => {
	const inputs = {
		stars: '*'.repeat(50000), 'star pairs': '*a '.repeat(17000), 'bold pairs': '**a *b '.repeat(8000), brackets: '['.repeat(50000), 'closed brackets': '[a]('.repeat(12000),
		ticks: '`'.repeat(50000), 'tick runs': '` `` ``` ````'.repeat(4000), unders: '_'.repeat(50000), tildes: '~'.repeat(50000), equals: '='.repeat(50000),
		percent: '%'.repeat(50000), pipes: '|'.repeat(50000), 'pipe rows': '| a | b |\n'.repeat(5000), hashes: '#'.repeat(50000), 'wiki open': '[['.repeat(25000),
		images: '![](data:'.repeat(5000), quotes: '>'.repeat(50000), 'quote lines': '> a\n'.repeat(17000), 'nested lists': '- '.repeat(25000), 'list lines': '- a\n  - b\n'.repeat(8000),
		spaces: ' '.repeat(50000) + 'x', 'blank lines': '- a\n' + '\n'.repeat(50000) + '- b', fences: '```\n'.repeat(12000), 'tags': '#a '.repeat(17000), 'footnotes': '[^a]'.repeat(12000),
		'long url': '[a](' + 'h'.repeat(50000) + ')', 'escapes': '\\'.repeat(50000), 'table head': ('| a ').repeat(10000) + '|\n' + '| - '.repeat(10000) + '|',
	}
	for (const [name, text] of Object.entries(inputs)) {
		const r = await call(`M.time(() => M.parse(${JSON.stringify(text)}))`)
		assert.ok(r.ms < 1500, `${name}: ${Math.round(r.ms)} ms`)
		const exported = await call(`M.time(() => M.toMarkdown(M.parse(${JSON.stringify(text)}).html))`)
		assert.ok(exported.ms < 3000, `${name} export: ${Math.round(exported.ms)} ms`)
	}
})

test('performance: input made of unmatched marks is parsed in linear time', async () => {
	const lim = 100 // ms, for input under 100 KB
	const inputs = {
		'unmatched *': '*a '.repeat(25000), 'unmatched _': '_a _'.repeat(20000), 'unmatched ~~': '~~a '.repeat(20000), 'unmatched ==': '==a '.repeat(20000),
		'unmatched %%': '%%a '.repeat(20000), 'mixed runs': '*a **b ***c '.repeat(8000), 'angle links without >': '[a](<'.repeat(18000),
		'image starts with one ")"': '![a](data:image/'.repeat(5000) + ')',
	}
	const best = async (text) => { let ms = Infinity; for (let k = 0; k < 3; k++) ms = Math.min(ms, (await call(`M.time(() => M.parse(${JSON.stringify(text)}))`)).ms); return ms }
	for (const [name, text] of Object.entries(inputs)) {
		assert.ok(text.length < 100000, name)
		const ms = await best(text)
		assert.ok(ms < lim, `${name}: ${Math.round(ms)} ms`)
	}
	// A 200 KB paste on one line goes through looksLikeMarkdown and parseMarkdown.
	const paste = '# t\n' + '*a '.repeat(66000)
	const ms = (await call(`M.time(() => { if (M.looks(${JSON.stringify(paste)})) M.parse(${JSON.stringify(paste)}, { max: 200000 }) })`)).ms
	assert.ok(ms < 200, `200 KB paste: ${Math.round(ms)} ms`)
})

test('a file at the size cap parses in a few seconds', async () => {
	const prose = 'word '.repeat(570000)
	const mixed = '# T\n\nSome **bold** and *it* with `code` and [a](https://x.test/) and #tag.\n\n- a\n- b\n\n'.repeat(30000)
	for (const [name, text] of Object.entries({ prose, mixed })) {
		const r = await call(`M.time(() => M.parse(${JSON.stringify(text)}))`)
		assert.ok(r.ms < 8000, `${name}: ${Math.round(r.ms)} ms`)
	}
})

test('import: per-file, total and file-count caps, and nothing but text', async () => {
	const r = await call(`(async () => {
		const mk = (n, size, type = 'text/markdown') => new File(['a'.repeat(size)], n, { type })
		const big = M.FILE - 1000
		const out = await M.readFiles([mk('big.md', M.FILE + 1), ...Array.from({ length: 12 }, (_, i) => mk('f' + i + '.md', big))], {})
		const many = await M.readFiles(Array.from({ length: M.FILES + 3 }, (_, i) => mk('s' + i + '.md', 3)), {})
		return { notes: out.notes.length, skipped: out.skipped.map((s) => s.join(': ')), many: many.notes.length, manySkipped: many.skipped.length, total: M.TOTAL, file: M.FILE }
	})()`)
	assert.equal(r.skipped[0], 'big.md: file is too large')
	assert.equal(r.notes, Math.floor(r.total / (r.file - 1000)), 'files are taken until the total would be passed')
	assert.ok(r.skipped.slice(1).every((s) => /over the total size limit/.test(s)))
	assert.equal(r.many, 500)
	assert.equal(r.manySkipped, 3)
})

test('security: input is capped, and the cap is a parameter', async () => {
	const r = await call(`(() => { const out = M.parse('a'.repeat(M.MAX + 500000)); return out.html.length })()`)
	assert.ok(r <= (await call('M.MAX')) + 40, `html ${r}`)
	assert.equal((await parse('abcdefghij', { max: 4 })).html, '<div>abcd</div>')
})

test('paste detection: prose stays plain, structure is Markdown', async () => {
	const looks = (t) => call(`M.looks(${JSON.stringify(t)})`)
	for (const plain of ['only text', 'Buy milk, eggs and bread.\nCall Anna at 5 pm.', 'a * b * c', 'snake_case_name here', 'cost is 5% or 10%', '#hashtag alone', 'a - b', 'x = y == z', 'Version 2.0 shipped']) assert.equal(await looks(plain), false, plain)
	for (const md of ['# Title', 'intro\n\n- one\n- two', '1. first\n2. second', '> quoted', '**bold** word', '[a](https://x.test)', '```\ncode\n```', '| a | b |\n| - | - |', 'see [[Note]]', 'a ~~b~~ c', 'run `ls` now', 'x[^1]']) assert.equal(await looks(md), true, md)
})

test('cards: structured plain text for every construct', async () => {
	const p = async (md) => (await call(`M.plain(${JSON.stringify((await parse(md)).html)})`)).trimEnd()
	assert.equal(await p('| Tool | Qty |\n| - | - |\n| hammer | 2 |'), 'Tool | Qty\nhammer | 2')
	assert.equal(await p('top\n\n---\n\nbottom'), 'top\n────────\nbottom')
	assert.equal(await p('```js\nlet a = 1\nlet b = 2\n```'), 'let a = 1\nlet b = 2')
	assert.equal(await p('> [!note] Heads up\n> mind the gap'), '› Heads up: mind the gap')
	assert.equal(await p('> [!tip]\n> plain title'), '› Tip: plain title')
	assert.equal(await p('a ==marked== b #tag [[Other|alias]] c'), 'a marked b #tag alias c')
	assert.equal(await p('claim[^1]\n\n[^1]: the source'), 'claim[1]\n[1] the source')
	assert.equal(await p('seen %%hidden%% here'), 'seen  here')
	assert.equal(await p('### Third'), 'Third')
})

test('cards: the old shapes are unchanged', async () => {
	const p = async (html) => (await call(`M.plain(${JSON.stringify(html)})`)).trimEnd()
	assert.equal(await p('<h1>T</h1><ul><li>a</li><li data-checked="true">b</li></ul><ol><li>c</li></ol><blockquote>q</blockquote>'), 'T\n• a\n☑ b\n1. c\n› q')
	assert.equal(await p('<div>one</div><div>two</div>'), 'one two')
})

test('export: a list the browser nested as <ul> inside <ul> becomes a nested Markdown list', async () => {
	assert.equal(await toMd('<ul><li>a</li><ul><li>b</li><ul><li>c</li></ul></ul><li>d</li></ul>'), '- a\n  - b\n    - c\n- d')
})

test('export escapes the new markers so typed text cannot become markup', async () => {
	const e = (html) => toMd(html)
	assert.equal(await e('<div>a == b ==c== %%x%% #tag [[x]] [^1] ~~y~~</div>'), 'a \\=\\= b \\=\\=c\\=\\= \\%\\%x\\%\\% \\#tag \\[\\[x\\]\\] \\[^1\\] \\~\\~y\\~\\~')
	assert.equal(await e('<div>| a | b |</div>'), '| a | b |')
	assert.equal(await e('<div># not heading</div><div>x # y</div><div>#7 and #tag2</div>'), '\\# not heading\n\nx # y\n\n#7 and \\#tag2')
	assert.equal(await e('<blockquote><div>[!note] literal</div></blockquote>'), '> \\[!note\\] literal')
	assert.equal(await e('<div>```js</div>'), '\\`\\`\\`js')
})
