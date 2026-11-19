// Note content is stored as HTML. DOMParser documents are inert: nothing in it loads or runs.
// shortcut: the cache is never trimmed, upgrade if a session holds thousands of long notes.
const cache = new Map()

// Lists, headings and quotes become lines of text: "• item", "2. item", "☐ task", "› quote". Cards show them with white-space: pre-line.
const prefixOf = (el) => {
	if (el.localName === 'li') {
		if (el.hasAttribute('data-checked')) return el.getAttribute('data-checked') === 'true' ? '☑ ' : '☐ '
		return el.parentElement?.localName === 'ol' ? `${Array.prototype.indexOf.call(el.parentElement.children, el) + 1}. ` : '• '
	}
	return el.localName === 'blockquote' ? '› ' : ''
}
const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const LINE_AFTER = new Set(['ul', 'ol', ...HEADINGS, 'blockquote', 'pre', 'tr'])
const LINE_BEFORE = new Set(['li', ...HEADINGS, 'blockquote', 'pre', 'tr'])
const RULE = '────────'

export default function plainText(html = '') {
	if (!cache.has(html)) {
		const doc = new DOMParser().parseFromString(html, 'text/html')
		// Only the line breaks added below count: a newline inside stored text stays a space, as it did before.
		doc.body.querySelectorAll('[data-comment]').forEach(el => el.remove())
		// Code keeps its line breaks; everywhere else a newline in stored text becomes a space.
		for (const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT); walker.nextNode();) if (!walker.currentNode.parentElement.closest('pre')) walker.currentNode.data = walker.currentNode.data.replace(/\n/g, ' ')
		doc.body.querySelectorAll('sup[data-fn]').forEach(el => { el.textContent = `[${el.getAttribute('data-fn')}]` })
		doc.body.querySelectorAll('br, div, p, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre, hr, tr, th, td').forEach(el => {
			const tag = el.localName
			if (tag === 'th' || tag === 'td') { if (el.nextElementSibling) el.append(' | '); return }
			if (tag === 'hr') { el.append('\n' + RULE + '\n'); return }
			if (tag === 'div' && el.parentElement?.hasAttribute('data-callout') && el === el.parentElement.firstElementChild) { el.append(': '); return }
			if (tag === 'div' && el.hasAttribute('data-fn-def')) { el.prepend(`\n[${el.getAttribute('data-fn-def')}] `); el.append('\n'); return }
			el.append(LINE_AFTER.has(tag) ? '\n' : ' ')
			if (LINE_BEFORE.has(tag)) el.prepend('\n' + prefixOf(el))
		})
		cache.set(html, doc.body.textContent.replace(/\s*\n\s*/g, '\n').replace(/^\n|\n$/g, ''))
	}
	return cache.get(html)
}
