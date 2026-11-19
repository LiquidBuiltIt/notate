import { TEXT_EDITOR_ID } from './TextInput.jsx'
import { parseInline, parseMarkdown, looksLikeMarkdown } from '@universal/Utils/mdParse.js'
import { CALLOUTS } from './InputFormatters.js'

// Typing Markdown in the editor. Every conversion goes through execCommand('insertHTML') where it can, so Ctrl+Z puts the typed text back.
// The HTML always comes from the parser (DOM-built, sanitized), never from the typed text itself.
const BLOCKS = new Set(['br', 'div', 'p', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table', 'hr'])
const GAP = '\u200b'
const FENCE = /^```([A-Za-z0-9+#-]{0,20})$/
const MAX_LOOK = 1000
const MARK_CHARS = '*_~=`%'
const editorOf = (root) => root.getElementById(TEXT_EDITOR_ID)
const here = (root, selector) => {
	const node = root.getSelection()?.anchorNode
	const el = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest(selector)
	return el && editorOf(root)?.contains(el) ? el : null
}

// The text node of the caret when it is a whole line at the end: "---", "```js", "| a | b |", "[!note] Title".
const lineAtCaret = (root, parents = ['div', 'p']) => {
	const sel = root.getSelection()
	const node = sel?.anchorNode
	if (!sel?.isCollapsed || node?.nodeType !== Node.TEXT_NODE || sel.anchorOffset !== node.data.length) return null
	const editor = editorOf(root), parent = node.parentElement
	if (!editor?.contains(node) || !(parent === editor || parents.includes(parent.localName))) return null
	if (node.previousSibling && !BLOCKS.has(node.previousSibling.localName)) return null
	if (node.nextSibling && node.nextSibling.localName !== 'br') return null
	return { sel, node, parent, editor, text: node.data.replace(/ /g, ' ') }
}

const selectLine = ({ sel, node }) => sel.setBaseAndExtent(node, 0, node, node.data.length)
const fresh = (editor, tag, known) => Array.from(editor.getElementsByTagName(tag)).find((el) => !known.has(el))
const collapseTo = (sel, node, offset) => sel.collapse(node, offset)
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.append(...kids); return e }
const blankLine = () => el('div', {}, el('br'))

// ---- Inline: **bold**, *italic*, ~~strike~~, ==mark==, `code`, [text](url), [[note]], [^1], %%comment%%, #tag ----

// The part of the text before the caret that a typed `last` character could close, or null.
const candidate = (before, last) => {
	if (MARK_CHARS.includes(last)) {
		let run = 0
		while (before[before.length - 1 - run] === last) run++
		if (run > 3) return null
		// The opening run must have the same length: "**bold*" waits for its second star.
		for (let from = before.length - run - 1, tries = 0; from >= 0 && tries < 20; tries++) {
			const at = before.lastIndexOf(last.repeat(run), from)
			if (at < 0) return null
			if (before[at - 1] !== last && before[at + run] !== last) return last === '_' && /[\p{L}\p{N}]/u.test(before[at - 1] ?? '') ? null : at
			from = at - 1
		}
		return null
	}
	if (last === ')') {
		const mid = before.lastIndexOf('](')
		const at = mid < 0 ? -1 : before.lastIndexOf('[', mid)
		return at >= 0 && before[at - 1] !== '!' ? at : null
	}
	if (last === ']') {
		if (before.endsWith(']]')) { const at = before.lastIndexOf('[['); return at }
		// At the start of a line "[^1]:" is a definition, so a reference needs text before it.
		const m = /\[\^[\w-]{1,20}\]$/.exec(before)
		return m && m.index > 0 ? m.index : null
	}
	// A tag ends at a space or punctuation.
	if (/[\s.,;:!?)]/.test(last)) {
		const m = /(^|[\s(\[{"'])(#[\p{L}\p{N}_\/-]+)$/u.exec(before.slice(0, -1))
		return m ? m.index + m[1].length : null
	}
	return null
}

// After a typed character: if it closed a Markdown span, replace the span by its element. Returns true when it did.
export const inlineShortcut = (root) => {
	const sel = root.getSelection()
	const node = sel?.anchorNode
	if (!sel?.isCollapsed || node?.nodeType !== Node.TEXT_NODE) return false
	const editor = editorOf(root)
	if (!editor?.contains(node) || node.parentElement.closest('pre, code, a, [data-comment], [data-tag], [data-note-link]')) return false
	const end = sel.anchorOffset
	const base = Math.max(0, end - MAX_LOOK)
	const before = node.data.slice(base, end)
	const last = before[before.length - 1]
	if (!last) return false
	const tag = !MARK_CHARS.includes(last) && last !== ')' && last !== ']'
	const stop = end
	const at = candidate(before, last)
	if (at === null || at < 0) return false
	const text = before.slice(at, tag ? -1 : undefined)
	const html = parseInline(text)
	const probe = new DOMParser().parseFromString(html, 'text/html').body
	if (probe.childNodes.length !== 1 || probe.firstChild.nodeType !== Node.ELEMENT_NODE) return false
	const known = new Set(editor.getElementsByTagName('*'))
	sel.setBaseAndExtent(node, base + at, node, stop)
	// The invisible character after the element keeps the next typed text outside it. It is removed on the next key and never stored.
	if (!document.execCommand('insertHTML', false, html + (tag ? last.replace(' ', '\u00a0') : GAP))) return false
	return true
}

// ---- Lines: --- + Enter, ``` + Enter, | a | b | + Enter, [!note] + Enter ----

const insertBlock = (ctx, node, caretIn) => {
	const { sel, editor } = ctx
	const known = { pre: new Set(editor.getElementsByTagName('pre')), table: new Set(editor.getElementsByTagName('table')), hr: new Set(editor.getElementsByTagName('hr')), blockquote: new Set(editor.getElementsByTagName('blockquote')) }
	selectLine(ctx)
	const holder = document.createElement('div')
	holder.append(node)
	if (!document.execCommand('insertHTML', false, holder.innerHTML)) return false
	const made = fresh(editor, node.localName, known[node.localName])
	if (made) caretIn(sel, made)
	return !!made
}

const toStart = (sel, target) => collapseTo(sel, target, 0)

// Returns true when the Enter was a conversion (the caller prevents the default).
export const enterShortcut = (root) => {
	// A fence typed in a list item: the item is emptied and left like an empty item, the fence text goes back in the new paragraph, and the code block is made as usual.
	const item = lineAtCaret(root, ['li'])
	if (item?.parent.localName === 'li' && FENCE.test(item.text)) {
		selectLine(item)
		document.execCommand('delete')
		document.execCommand('insertParagraph')
		document.execCommand('insertText', false, item.text)
	}
	const ctx = lineAtCaret(root, ['div', 'p', 'blockquote'])
	if (!ctx) return false
	const { text, parent } = ctx
	const inQuote = parent.localName === 'blockquote' || parent.closest('blockquote')
	if (!inQuote && /^(---|\*\*\*|___)$/.test(text.trim()) && text.trim() === text) {
		return insertBlock(ctx, el('hr'), (sel, hr) => {
			const next = hr.nextElementSibling?.localName === 'div' ? hr.nextElementSibling : null
			const line = next ?? hr.parentNode.insertBefore(blankLine(), hr.nextSibling)
			toStart(sel, line)
		})
	}
	const fence = !inQuote && FENCE.exec(text)
	if (fence) {
		const lang = fence[1].toLowerCase()
		const pre = el('pre', lang ? { 'data-lang': lang } : {}, el('code', {}, el('br')))
		return insertBlock(ctx, pre, (sel, made) => toStart(sel, made.firstChild))
	}
	const row = !inQuote && /^\|(.+)\|$/.exec(text.trim())
	if (row) {
		const cells = row[1].split('|').map((c) => c.trim())
		if (cells.length >= 2 && cells.length <= 12) {
			const table = el('table', {},
				el('thead', {}, el('tr', {}, ...cells.map((c) => el('th', {}, c || document.createElement('br'))))),
				el('tbody', {}, el('tr', {}, ...cells.map(() => el('td', {}, el('br'))))))
			return insertBlock(ctx, table, (sel, made) => {
				if (!made.nextElementSibling) made.parentNode.append(blankLine())
				toStart(sel, made.querySelector('tbody td'))
			})
		}
	}
	const bq = parent.localName === 'blockquote' ? parent : parent.closest('blockquote')
	const callout = bq && !bq.hasAttribute('data-callout') && /^\[!([A-Za-z]{1,20})\][+-]?[ \t]*(.*)$/.exec(bq.textContent.trim())
	if (callout && CALLOUTS.includes(callout[1].toLowerCase()) && bq.querySelectorAll('div, p').length <= 1 && !bq.querySelector('br:not(:last-child)')) {
		const type = callout[1].toLowerCase()
		const title = callout[2].trim() || type[0].toUpperCase() + type.slice(1)
		const quote = el('blockquote', { 'data-callout': type }, el('div', {}, title), blankLine())
		// shortcut: swapped in the DOM, not through execCommand, so Ctrl+Z does not bring back the literal line.
		bq.replaceWith(quote)
		toStart(ctx.sel, quote.lastElementChild)
		return true
	}
	return false
}

// ---- Quotes and callouts: Enter leaves the block (the text after the caret goes with it), Shift+Enter is the browser's own line break ----
export const quoteEnter = (root) => {
	const nearest = root.getSelection()?.isCollapsed && here(root, 'blockquote, li, td, th, pre')
	if (nearest?.localName !== 'blockquote') return false
	if (here(root, 'div, p, blockquote').textContent.replace(/\u200b/g, '') !== '') document.execCommand('insertParagraph')
	const line = here(root, 'div, p, blockquote')
	// A quote with the text in it directly: Chrome made a new quote for the line, and this makes it a paragraph.
	if (line.localName === 'blockquote') return document.execCommand('formatBlock', false, 'div') || true
	// shortcut: a line inside a quote or callout is moved in the DOM, so Ctrl+Z steps back through the typing but does not undo the move.
	const quote = line.closest('blockquote')
	const range = document.createRange()
	range.setStartAfter(line)
	range.setEndAfter(quote.lastChild)
	const tail = quote.cloneNode(false) // lines below the caret stay quoted, as a plain quote
	tail.removeAttribute('data-callout')
	tail.append(range.extractContents())
	quote.after(line)
	if (tail.firstChild) line.after(tail)
	if (!quote.textContent) quote.remove()
	root.getSelection().collapse(line, 0)
	return true
}

// ---- Code blocks ----

// True when the caret is right after a line break, so the last line is empty.
const afterBreak = (sel, code) => {
	const r = document.createRange()
	r.selectNodeContents(code)
	r.setEnd(sel.anchorNode, sel.anchorOffset)
	const last = r.cloneContents().lastChild
	return last?.localName === 'br' || (last?.nodeType === Node.TEXT_NODE && last.data.endsWith('\n'))
}

const atEnd = (sel, code) => {
	const r = document.createRange()
	r.selectNodeContents(code)
	r.setStart(sel.anchorNode, sel.anchorOffset)
	return r.toString() === ''
}

// Keys inside a code block: Enter adds a line (a second Enter on an empty last line leaves), Tab adds spaces, Arrow-down at the end leaves.
export const codeKey = (root, event) => {
	const pre = here(root, 'pre')
	const sel = root.getSelection()
	if (!pre || !sel?.isCollapsed) return false
	const leave = () => {
		const code = pre.querySelector('code')
		if (code?.lastChild?.localName === 'br') code.lastChild.remove()
		const line = pre.nextElementSibling?.localName === 'div' ? pre.nextElementSibling : pre.parentNode.insertBefore(blankLine(), pre.nextSibling)
		toStart(sel, line)
	}
	if (event.key === 'Tab' && !event.shiftKey) return document.execCommand('insertText', false, '  ') || true
	if (event.key === 'Tab') return true
	if (event.key === 'Enter' && !event.shiftKey) {
		const code = pre.querySelector('code') ?? pre
		if (atEnd(sel, code) && afterBreak(sel, code)) {
			// Drop the empty line the first Enter made, then leave.
			document.execCommand('delete')
			leave()
		} else document.execCommand('insertText', false, '\n')
		return true
	}
	if (event.key === 'ArrowDown' && atEnd(sel, pre)) { leave(); return true }
	return false
}

// ---- Footnote definitions: "[^1]:" + Space at the start of a line ----
export const footnoteShortcut = (root) => {
	const ctx = lineAtCaret(root)
	const m = ctx && /^\[\^([\w-]{1,20})\]:$/.exec(ctx.text)
	if (!m) return false
	selectLine(ctx)
	document.execCommand('delete')
	if (ctx.parent === ctx.editor) document.execCommand('formatBlock', false, 'div')
	const line = here(root, 'div, p')
	if (!line) return false
	line.setAttribute('data-fn-def', m[1])
	return true
}

// ---- Paste ----
export const pasteMarkdown = (text) => {
	if (text.length > 200000 || !looksLikeMarkdown(text)) return false
	const { html } = parseMarkdown(text, { max: 200000 })
	return html ? document.execCommand('insertHTML', false, html) : false
}

// ---- Lists and tables: Tab and Shift+Tab ----
export const tabKey = (root, event) => {
	const sel = root.getSelection()
	const cell = here(root, 'td, th')
	if (cell && sel?.isCollapsed) {
		const table = cell.closest('table')
		const cells = Array.from(table.querySelectorAll('th, td'))
		const i = cells.indexOf(cell)
		let target = cells[i + (event.shiftKey ? -1 : 1)]
		if (!event.shiftKey && !target) {
			const row = cell.parentElement
			const added = el('tr', {}, ...Array.from(row.children, () => el('td', {}, el('br'))))
			;(table.tBodies[0] ?? table).append(added)
			target = added.firstElementChild
		}
		if (target) { const r = document.createRange(); r.selectNodeContents(target); sel.removeAllRanges(); sel.addRange(r); sel.collapseToEnd() }
		return true
	}
	if (here(root, 'li')) {
		document.execCommand(event.shiftKey ? 'outdent' : 'indent')
		return true
	}
	return false
}
