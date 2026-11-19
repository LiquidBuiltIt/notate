// Markdown (Obsidian flavour, tiers 1 and 2) to note HTML. Pasted and imported text is untrusted.
// Safety rules: elements are built with createElement and textContent only, never from a string;
// raw HTML in the text stays text; links are http/https only; every scan is bounded; the result is sanitized again.
// Each line is parsed on its own, and a marker looks for its partner within WINDOW characters (shortcut: longer spans stay literal).
import { sanitizeHtml, CALLOUTS, TAG, FOOTNOTE, uniqueId } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'

export const MAX_MD = 3_000_000
export const IMAGE_DATA = /^data:image\/(?!svg)[a-z0-9.+-]+;base64,[A-Za-z0-9+\/]+={0,2}$/i
const WINDOW = 3000
const MAX_NEST = 20 // blocks inside blocks
const MAX_INLINE = 8 // marks inside marks
const MAX_COLS = 50
const MAX_ROWS = 5000
const PUNCT = /[!-\/:-@\[-`{-~]/
const WORD = /[\p{L}\p{N}]/u
const TAG_CHAR = /[\p{L}\p{N}_\/-]/u
const LANG = /^[a-z0-9+#-]{1,20}$/
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const LIST = /^( *)([-*+]|\d{1,9}[.)])(?: +(.*))?$/
const FN_DEF = /^\[\^([\w-]{1,20})\]:[ \t]*(.*)$/
const CALLOUT = /^\[!([A-Za-z]{1,20})\][+-]?[ \t]*(.*)$/

const blank = (l) => l.trim() === ''
const indentOf = (l) => l.length - l.trimStart().length
const isHr = (l) => indentOf(l) < 4 && /^(-{3,}|\*{3,}|_{3,})$/.test(l.replace(/ /g, ''))
const closing = (t) => { // a heading may end with " ###"
	let j = t.length
	while (j > 0 && t[j - 1] === '#') j--
	return j < t.length && (j === 0 || t[j - 1] === ' ') ? t.slice(0, j).trimEnd() : t
}
const cap = (s) => s[0].toUpperCase() + s.slice(1)

const bracketMap = (t) => {
	const map = new Map(), stack = []
	for (let k = 0; k < t.length; k++) {
		if (t[k] === '\\') k++
		else if (t[k] === '[') stack.push(k)
		else if (t[k] === ']' && stack.length) map.set(stack.pop(), k)
	}
	return map
}

const safeUrl = (raw) => {
	const url = raw.replace(/\\([!-\/:-@\[-`{-~])/g, '$1')
	if (url.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(url) || !URL.canParse(url)) return null
	return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null
}

// `[text](url "title")` destination, starting right after "(". Returns { url, end } or null.
const destination = (t, start) => {
	let k = start, depth = 0
	const lim = Math.min(t.length, start + 2048)
	if (t[k] === '<') { const e = t.indexOf('>', k); if (e === -1 || e > lim) return null; k = e + 1; return t[k] === ')' ? { url: t.slice(start + 1, e), end: k + 1 } : null }
	for (; k < lim; k++) {
		const ch = t[k]
		if (ch === '\\') k++
		else if (ch === ' ' || ch === '\t') break
		else if (ch === '(') depth++
		else if (ch === ')') { if (depth === 0) break; depth-- }
	}
	const url = t.slice(start, k)
	while (t[k] === ' ') k++
	if (t[k] === '"') { const e = t.indexOf('"', k + 1); if (e === -1 || e - k > 500) return null; k = e + 1; while (t[k] === ' ') k++ }
	return t[k] === ')' && url ? { url, end: k + 1 } : null
}

// Finds the partner of an opening run of `c` (length `run`). A run of exactly `run` wins; else the first longer run, whose last `run` characters close.
const closer = (t, c, run, from, wordEdge) => {
	let fallback = -1, k = t.indexOf(c, from)
	const lim = Math.min(t.length, from + WINDOW)
	while (k !== -1 && k < lim) {
		let e = k
		while (t[e] === c) e++
		const m = e - k
		const okBefore = c === '%' || (t[k - 1] !== ' ' && t[k - 1] !== '\t')
		const okAfter = !wordEdge || !WORD.test(t[e] ?? '')
		if (m >= run && okBefore && okAfter) {
			if (m === run) return k
			if (fallback === -1) fallback = e - run
		}
		k = t.indexOf(c, e)
	}
	return fallback
}

const MARKS = { '*': [null, ['i'], ['b'], ['b', 'i']], _: [null, ['i'], ['b'], ['b', 'i']], '~': [null, null, ['s']], '=': [null, null, ['mark']], '%': [null, null, ['comment']] }

function inline(doc, text, parent, depth = 0, noLink = false) {
	let buf = ''
	const flush = () => { if (buf) { parent.append(doc.createTextNode(buf)); buf = '' } }
	const make = (tag, attrs = {}) => { const el = doc.createElement(tag); for (const k in attrs) el.setAttribute(k, attrs[k]); flush(); parent.append(el); return el }
	let brackets = null
	const matching = () => (brackets ??= bracketMap(text))
	let noImageEnd = false
	const n = text.length
	let i = 0
	while (i < n) {
		const c = text[i]
		if (c === '\\' && i + 1 < n && PUNCT.test(text[i + 1])) { buf += text[i + 1]; i += 2; continue }
		if (c === '`') {
			let j = i
			while (text[j] === '`') j++
			const run = j - i
			const lim = Math.min(n, j + WINDOW)
			let k = text.indexOf('`', j), end = -1
			while (k !== -1 && k < lim) {
				let e = k
				while (text[e] === '`') e++
				if (e - k === run) { end = k; break }
				k = text.indexOf('`', e)
			}
			if (end > j) {
				let code = text.slice(j, end)
				if (code.length > 2 && code[0] === ' ' && code.endsWith(' ') && code.trim()) code = code.slice(1, -1)
				make('code').textContent = code
				i = end + run
			} else { buf += text.slice(i, j); i = j }
			continue
		}
		if (c in MARKS) {
			let j = i
			while (text[j] === c) j++
			const run = j - i
			const kinds = run < 4 ? MARKS[c][run] : null
			const next = text[j]
			const opens = kinds && depth < MAX_INLINE && next !== undefined && (c === '%' || (next !== ' ' && next !== '\t')) && (c !== '_' || !WORD.test(text[i - 1] ?? ''))
			const end = opens ? closer(text, c, run, j, c === '_') : -1
			const inner = end > j ? text.slice(j, end) : ''
			if (inner && (c === '%' ? !inner.includes('%%') && inner.trim() : true)) {
				if (kinds[0] === 'comment') make('span', { 'data-comment': '' }).textContent = inner
				else {
					flush()
					let outer = null, el = null
					for (const tag of kinds) { const e = doc.createElement(tag); if (el) el.append(e); else outer = e; el = e }
					parent.append(outer)
					inline(doc, inner, el, depth + 1, noLink)
				}
				i = end + run
			} else { buf += text.slice(i, j); i = j }
			continue
		}
		if (c === '[' && text[i + 1] === '[') {
			const body = text.slice(i + 2, i + 404)
			const e = body.indexOf(']]')
			if (e > 0) {
				const raw = body.slice(0, e)
				const bar = raw.indexOf('|')
				const target = (bar === -1 ? raw : raw.slice(0, bar)).trim()
				const alias = bar === -1 ? '' : raw.slice(bar + 1).trim()
				if (target && target.length <= 200 && !/[\[\]|\u0000-\u001f]/.test(target) && !/[\[\]]/.test(alias)) {
					make('span', { 'data-note-link': target }).textContent = alias || target
					i += e + 4
					continue
				}
			}
		} else if (c === '[' && text[i + 1] === '^') {
			const m = /^\[\^([\w-]{1,20})\]/.exec(text.slice(i, i + 26))
			if (m) { make('sup', { 'data-fn': m[1] }).textContent = m[1]; i += m[0].length; continue }
		} else if (c === '[' && !noLink && depth < MAX_INLINE) {
			const close = matching().get(i)
			const dest = close !== undefined && text[close + 1] === '(' ? destination(text, close + 2) : null
			const href = dest && safeUrl(dest.url)
			if (href) {
				inline(doc, text.slice(i + 1, close), make('a', { href }), depth + 1, true)
				i = dest.end
				continue
			}
		} else if (c === '!' && text[i + 1] === '[' && !noImageEnd) {
			const close = matching().get(i + 1)
			if (close !== undefined && text.startsWith('(data:image/', close + 1)) {
				const e = text.indexOf(')', close + 2)
				if (e === -1) noImageEnd = true
				else if (IMAGE_DATA.test(text.slice(close + 2, e))) {
					make('img', { src: text.slice(close + 2, e), id: uniqueId('img') })
					i = e + 1
					continue
				}
			}
		} else if (c === '#' && (i === 0 || /[\s(\[{"']/.test(text[i - 1]))) {
			let j = i + 1
			while (j < n && j - i <= 100 && TAG_CHAR.test(text[j])) j++
			let name = text.slice(i + 1, j)
			while (name.endsWith('/')) name = name.slice(0, -1)
			if (TAG.test(name) && /[\p{L}_]/u.test(name)) {
				make('span', { 'data-tag': name }).textContent = '#' + name
				i += 1 + name.length
				continue
			}
		}
		buf += c
		i++
	}
	flush()
}

const splitRow = (line) => {
	let t = line.trim()
	if (t.startsWith('|')) t = t.slice(1)
	if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1)
	const cells = []
	let cur = ''
	for (let k = 0; k < t.length; k++) {
		if (t[k] === '\\' && t[k + 1] === '|') { cur += '\\|'; k++ }
		else if (t[k] === '|') { cells.push(cur); cur = '' }
		else cur += t[k]
	}
	cells.push(cur)
	return cells
}
const isDelim = (cells) => cells.every((c) => /^:?-+:?$/.test(c.trim()))
const tableAt = (lines, i) => {
	if (i + 1 >= lines.length || !lines[i].includes('|') || !lines[i + 1].includes('-')) return false
	const head = splitRow(lines[i]), delim = splitRow(lines[i + 1])
	return head.length === delim.length && head.length <= MAX_COLS && isDelim(delim)
}
const startsBlock = (l) => HEADING.test(l) || FENCE.test(l) || isHr(l) || /^ {0,3}>/.test(l) || LIST.test(l) || FN_DEF.test(l)

function blocks(doc, lines, parent, depth) {
	const n = lines.length
	let i = 0
	while (i < n) {
		const line = lines[i]
		if (blank(line)) { i++; continue }
		const text = depth >= MAX_NEST
		let m
		if (!text && (m = FENCE.exec(line)) && !(m[1][0] === '`' && m[2].includes('`'))) {
			const ch = m[1][0], len = m[1].length
			const word = m[2].trim().split(' ')[0].toLowerCase()
			const body = []
			for (i++; i < n; i++) {
				const t = lines[i].trim()
				if (t.length >= len && [...t].every((x) => x === ch)) break
				body.push(lines[i])
			}
			i++
			const pre = doc.createElement('pre')
			if (LANG.test(word)) pre.setAttribute('data-lang', word)
			pre.append(doc.createElement('code'))
			pre.firstChild.textContent = body.join('\n')
			parent.append(pre)
		} else if (!text && (m = HEADING.exec(line))) {
			i++
			const t = closing((m[2] ?? '').trim())
			if (!t) continue
			inline(doc, t, parent.appendChild(doc.createElement('h' + m[1].length)))
		} else if (!text && isHr(line)) {
			parent.append(doc.createElement('hr'))
			i++
		} else if (!text && /^ {0,3}>/.test(line)) {
			const inner = []
			for (; i < n && /^ {0,3}>/.test(lines[i]); i++) inner.push(lines[i].replace(/^ {0,3}> ?/, ''))
			const bq = parent.appendChild(doc.createElement('blockquote'))
			const co = CALLOUT.exec(inner[0])
			const type = co?.[1].toLowerCase()
			if (CALLOUTS.includes(type)) {
				bq.setAttribute('data-callout', type)
				const title = bq.appendChild(doc.createElement('div'))
				if (co[2].trim()) inline(doc, co[2].trim(), title)
				else title.textContent = cap(type)
				blocks(doc, inner.slice(1), bq, depth + 1)
			} else blocks(doc, inner, bq, depth + 1)
		} else if (!text && (m = FN_DEF.exec(line))) {
			const div = parent.appendChild(doc.createElement('div'))
			div.setAttribute('data-fn-def', m[1])
			inline(doc, m[2].trim(), div)
			i++
		} else if (!text && LIST.test(line)) {
			i = list(doc, lines, i, parent, depth)
		} else if (!text && tableAt(lines, i)) {
			i = table(doc, lines, i, parent)
		} else {
			const div = parent.appendChild(doc.createElement('div'))
			let first = true
			do {
				if (!first) div.append(doc.createElement('br'))
				first = false
				inline(doc, lines[i].trim(), div)
				i++
			} while (i < n && !blank(lines[i]) && (text || !(startsBlock(lines[i]) || tableAt(lines, i))))
		}
	}
}

function list(doc, lines, start, parent, depth) {
	const n = lines.length
	const first = LIST.exec(lines[start])
	const base = first[1].length
	const ordered = /\d/.test(first[2][0])
	const ul = parent.appendChild(doc.createElement(ordered ? 'ol' : 'ul'))
	let i = start
	while (i < n) {
		const m = LIST.exec(lines[i])
		if (!m || m[1].length !== base || /\d/.test(m[2][0]) !== ordered || isHr(lines[i])) break
		let content = m[3] ?? ''
		const sub = [content]
		const contentIndent = base + m[2].length + 1
		let j = i + 1
		while (j < n) {
			if (blank(lines[j])) {
				let k = j
				while (k < n && blank(lines[k])) k++
				if (k >= n || indentOf(lines[k]) <= base) break
				for (; j < k; j++) sub.push('')
			} else {
				const ind = indentOf(lines[j])
				if (ind <= base) break
				sub.push(lines[j].slice(Math.min(ind, contentIndent)))
				j++
			}
		}
		const li = ul.appendChild(doc.createElement('li'))
		const task = /^\[([ xX])\](?: +|$)/.exec(content)
		if (task) { li.setAttribute('data-checked', task[1] === ' ' ? 'false' : 'true'); sub[0] = content.slice(task[0].length) }
		const tmp = doc.createElement('div')
		blocks(doc, sub, tmp, depth + 1)
		const head = tmp.firstElementChild
		if (head?.localName === 'div' && !head.attributes.length) { li.append(...head.childNodes); head.remove() }
		li.append(...tmp.childNodes)
		i = j
		let k = i
		while (k < n && blank(lines[k])) k++
		const next = k > i && k < n ? LIST.exec(lines[k]) : null
		if (next && next[1].length === base && /\d/.test(next[2][0]) === ordered) i = k
	}
	return i
}

function table(doc, lines, start, parent) {
	const head = splitRow(lines[start])
	const t = parent.appendChild(doc.createElement('table'))
	const row = (host, tag, cells) => {
		const tr = host.appendChild(doc.createElement('tr'))
		for (let c = 0; c < head.length; c++) inline(doc, (cells[c] ?? '').trim(), tr.appendChild(doc.createElement(tag)))
	}
	row(t.appendChild(doc.createElement('thead')), 'th', head)
	const body = t.appendChild(doc.createElement('tbody'))
	let i = start + 2
	for (; i < lines.length && i < start + MAX_ROWS && !blank(lines[i]) && lines[i].includes('|'); i++) row(body, 'td', splitRow(lines[i]))
	if (!body.firstChild) body.remove()
	return i
}

const frontMatter = (lines) => {
	const meta = {}
	if (lines[0]?.trim() !== '---') return [meta, 0]
	for (let e = 1; e < Math.min(lines.length, 200); e++) {
		if (lines[e].trim() === '---') {
			for (const l of lines.slice(1, e)) {
				const m = /^([A-Za-z_][\w-]{0,40}):[ \t]*(.*)$/.exec(l)
				if (!m) continue
				let v = m[2].trim()
				if (v.startsWith('"')) { try { v = String(JSON.parse(v)) } catch { /* keep the raw text */ } }
				else if (/^'.*'$/.test(v)) v = v.slice(1, -1)
				meta[m[1].toLowerCase()] = v
			}
			return [meta, e + 1]
		}
	}
	return [meta, 0]
}

// Returns { html, meta }. `html` has passed the note sanitizer. With `front`, a leading front matter block is read into `meta` and removed.
export function parseMarkdown(src, { max = MAX_MD, front = false } = {}) {
	const text = String(src ?? '').slice(0, max).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
	const lines = text.split('\n').map((l) => l.replace(/^\t+/, (t) => '    '.repeat(t.length)))
	const [meta, skip] = front ? frontMatter(lines) : [{}, 0]
	const doc = document.implementation.createHTMLDocument('')
	blocks(doc, skip ? lines.slice(skip) : lines, doc.body, 0)
	return { html: sanitizeHtml(doc.body.innerHTML), meta }
}

// One line of Markdown to sanitized inline HTML, for the as-you-type conversions.
export function parseInline(text) {
	const doc = document.implementation.createHTMLDocument('')
	inline(doc, String(text).slice(0, 4000), doc.body)
	return sanitizeHtml(doc.body.innerHTML)
}

// True when pasted text has Markdown structure worth converting. Plain prose is left alone. Bounded: 500 lines, 300 characters each.
export function looksLikeMarkdown(text) {
	for (const raw of String(text).split('\n', 500)) {
		const l = raw.slice(0, 300)
		if (/^ {0,3}#{1,6} +\S/.test(l)) return true
		if (FENCE.test(l) || /^ {0,3}> ?\S/.test(l) || /^ {0,3}([-*+]|\d{1,9}[.)]) +\S/.test(l)) return true
		if (/^\s{0,3}\|?[ :-]{0,40}-[ :|-]{0,40}$/.test(l) && l.includes('|')) return true
		for (const mark of ['**', '==', '~~']) { const a = l.indexOf(mark); if (a >= 0 && l.indexOf(mark, a + 3) > a + 2) return true }
		if (/\]\(https?:\/\//.test(l) || /\[\[[^\]]+\]\]/.test(l) || /\[\^[\w-]+\]/.test(l)) return true
		const tick = l.indexOf('`'); if (tick >= 0 && l.indexOf('`', tick + 2) > tick + 1) return true
	}
	return false
}
