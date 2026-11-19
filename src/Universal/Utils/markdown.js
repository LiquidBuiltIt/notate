// Note HTML to Markdown. The HTML is cleaned by the note sanitizer first, then read from an inert document.
// All text is escaped, so a typed "[x](javascript:...)" or "<img onerror>" stays literal in the output.
import { sanitizeHtml, TAG } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'

import { IMAGE_DATA as IMAGE } from '@universal/Utils/mdParse.js'

const BLOCK_TAGS = new Set(['div', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'pre', 'table'])
const HAS_BLOCK = 'div, p, ul, ol, li, h1, h2, h3, h4, h5, h6, blockquote, hr, pre, table, br'
const MAX_DEPTH = 100 // deeper than this, an element is written as its plain text

// Inline text: control characters and line breaks become one space, then Markdown and HTML specials are escaped.
export const esc = (s) => String(s ?? '')
	.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ')
	.replace(/[\\`*_[\]<>&~]/g, '\\$&')
	.replace(/=(?==)|(?<==)=/g, '\\=').replace(/%(?=%)|(?<=%)%/g, '\\%')
	.replace(/(^|[\s(\[{"'])#(?=[\p{L}\p{N}_\/-]*[\p{L}_])/gu, '$1\\#')

// One line of plain text: trimmed, and a leading "#", ">", "-", "1." ... cannot start a block.
export const mdText = (s) => esc(s).trim().replace(/^([>+=-])/, '\\$1').replace(/^#(?=#*(?:\s|$))/, '\\#').replace(/^(\d+)([.)])/, '$1\\$2')

// Text of a code block: line breaks are kept.
const preText = (el) => {
	let out = ''
	for (const w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); w.nextNode();) {
		const n = w.currentNode
		if (n.nodeType === Node.TEXT_NODE) out += n.data
		else if (n.localName === 'br' || ((n.localName === 'div' || n.localName === 'p') && out && !out.endsWith('\n'))) out += '\n'
	}
	return out
}

const head = (level, escaped) => `${'#'.repeat(Math.min(6, level))} ${escaped.replace(/#+$/, '\\$&')}`
export const mdTitle = (level, s) => head(level, esc(s).trim() || 'Untitled')

const wrap = (mark, s) => {
	const [, a, core, z] = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)
	return core ? a + mark + core + mark + z : s
}

export function toMarkdown(html, headingShift = 0) {
	const inline = (node, depth) => Array.from(node.childNodes, (c) =>
		c.nodeType === Node.TEXT_NODE ? esc(c.data) : c.nodeType === Node.ELEMENT_NODE ? inlineEl(c, depth) : '').join('')

	const inlineEl = (el, depth) => {
		if (depth > MAX_DEPTH) return esc(el.textContent)
		switch (el.localName) {
			case 'b': return wrap('**', inline(el, depth + 1))
			case 'i': return wrap('*', inline(el, depth + 1))
			case 's': case 'strike': return wrap('~~', inline(el, depth + 1))
			case 'br': return ' '
			case 'mark': return wrap('==', inline(el, depth + 1))
			case 'code': {
				const t = el.textContent.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
				if (!t.trim()) return ''
				const fence = '`'.repeat(Math.max(0, ...(t.match(/`+/g) ?? []).map((r) => r.length)) + 1)
				return fence + (/^[ `]|[ `]$/.test(t) ? ` ${t} ` : t) + fence
			}
			case 'sup': return el.hasAttribute('data-fn') ? `[^${el.getAttribute('data-fn')}]` : inline(el, depth + 1)
			case 'span': {
				if (el.hasAttribute('data-comment')) { const t = el.textContent.replace(/%+/g, '').replace(/\s+/g, ' ').trim(); return t ? `%%${t}%%` : '' }
				const link = el.getAttribute('data-note-link')
				if (link !== null) { const alias = el.textContent.replace(/[\[\]|]/g, ' ').replace(/\s+/g, ' ').trim(); return alias && alias !== link ? `[[${link}|${alias}]]` : `[[${link}]]` }
				const tag = el.getAttribute('data-tag')
				if (tag !== null && TAG.test(tag)) return '#' + tag
				return inline(el, depth + 1)
			}
			case 'img': { const src = el.getAttribute('src') ?? ''; return IMAGE.test(src) ? `![](${src})` : '' }
			case 'a': {
				const text = inline(el, depth + 1).trim()
				const href = el.getAttribute('href') ?? ''
				if (!URL.canParse(href) || !['http:', 'https:'].includes(new URL(href).protocol)) return text
				const url = new URL(href).href.replace(/[\s()<>\\`"]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
				return `[${text || esc(url)}](${url})`
			}
			default: return inline(el, depth + 1) // u, span, font
		}
	}

	// Returns the blocks of `parent` as strings, to be joined by blank lines.
	const blocks = (parent, depth, skip = null) => {
		const out = []
		let run = ''
		const flush = () => {
			const t = run.trim()
			if (t) out.push(t.replace(/^([>+=-])/, '\\$1').replace(/^#(?=#*(?:\s|$))/, '\\#').replace(/^(\d+)([.)])/, '$1\\$2'))
			run = ''
		}
		for (const c of parent.childNodes) {
			if (c === skip) continue
			if (c.nodeType === Node.TEXT_NODE) run += esc(c.data)
			else if (c.nodeType !== Node.ELEMENT_NODE) continue
			else if (depth > MAX_DEPTH) run += esc(c.textContent)
			else if (c.localName === 'br') flush()
			else if (BLOCK_TAGS.has(c.localName) || c.querySelector(HAS_BLOCK)) { flush(); out.push(...block(c, depth)) }
			else run += inlineEl(c, depth)
		}
		flush()
		return out
	}

	const block = (el, depth) => {
		const tag = el.localName
		if (/^h[1-6]$/.test(tag)) {
			const text = inline(el, depth + 1).replace(/\s+/g, ' ').trim()
			return text ? [head(Number(tag[1]) + headingShift, text)] : []
		}
		if (tag === 'hr') return ['---']
		if (tag === 'pre') {
			const text = preText(el).replace(/\n+$/, '')
			const fence = '`'.repeat(Math.max(2, ...(text.match(/`+/g) ?? []).map((r) => r.length)) + 1)
			const lang = el.getAttribute('data-lang') ?? ''
			return [`${fence}${lang}\n${text}\n${fence}`]
		}
		if (tag === 'div' && el.hasAttribute('data-fn-def')) return [`[^${el.getAttribute('data-fn-def')}]: ${inline(el, depth + 1).replace(/\s+/g, ' ').trim()}`]
		if (tag === 'table') {
			const rows = Array.from(el.querySelectorAll('tr'), (tr) => Array.from(tr.children).filter((c) => c.localName === 'td' || c.localName === 'th'))
			const cols = Math.max(0, ...rows.map((r) => r.length))
			if (!cols) return []
			const line = (r) => '| ' + Array.from({ length: cols }, (_, i) => (r[i] ? inline(r[i], depth + 1).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() : '')).join(' | ') + ' |'
			return [[line(rows[0]), '| ' + Array(cols).fill('---').join(' | ') + ' |', ...rows.slice(1).map(line)].join('\n')]
		}
		if (tag === 'blockquote') {
			const type = el.getAttribute('data-callout')
			const first = type && ['div', 'p'].includes(el.firstElementChild?.localName) ? el.firstElementChild : null
			const title = first ? inline(first, depth + 1).replace(/\s+/g, ' ').trim() : ''
			const body = blocks(el, depth + 1, first).join('\n\n')
			const lines = (type ? [`[!${type}]${title && title !== esc(type[0].toUpperCase() + type.slice(1)) ? ' ' + title : ''}`] : []).concat(body ? body.split('\n') : []).map((l) => (l ? `> ${l}` : '>'))
			return lines.length > 1 || lines[0] !== '>' ? [lines.join('\n')] : []
		}
		if (tag === 'ul' || tag === 'ol') {
			// shortcut: a child of a list that is not an <li> is dropped; the editor never makes one.
			const items = Array.from(el.children).filter((c) => c.localName === 'li').map((li, i) => {
				const mark = (tag === 'ol' ? `${i + 1}. ` : '- ') + (li.hasAttribute('data-checked') ? (li.getAttribute('data-checked') === 'true' ? '[x] ' : '[ ] ') : '')
				const lines = blocks(li, depth + 1).join('\n').split('\n')
				const pad = ' '.repeat(tag === 'ol' ? String(i + 1).length + 2 : 2)
				return (mark + lines.map((l, j) => (j ? pad + l : l)).join('\n')).trimEnd()
			})
			return items.length ? [items.join('\n')] : []
		}
		return blocks(el, depth + 1)
	}

	const doc = new DOMParser().parseFromString(sanitizeHtml(String(html ?? '')), 'text/html')
	return blocks(doc.body, 0).join('\n\n')
}
