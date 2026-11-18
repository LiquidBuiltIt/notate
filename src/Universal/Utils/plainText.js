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
const LINE_AFTER = new Set(['ul', 'ol', 'h1', 'h2', 'blockquote'])
const LINE_BEFORE = new Set(['li', 'h1', 'h2', 'blockquote'])

export default function plainText(html = '') {
	if (!cache.has(html)) {
		const doc = new DOMParser().parseFromString(html, 'text/html')
		// Only the line breaks added below count: a newline inside stored text stays a space, as it did before.
		for (const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT); walker.nextNode();) walker.currentNode.data = walker.currentNode.data.replace(/\n/g, ' ')
		doc.body.querySelectorAll('br, div, p, li, ul, ol, h1, h2, blockquote').forEach(el => {
			el.append(LINE_AFTER.has(el.localName) ? '\n' : ' ')
			if (LINE_BEFORE.has(el.localName)) el.prepend('\n' + prefixOf(el))
		})
		cache.set(html, doc.body.textContent.replace(/\s*\n\s*/g, '\n').replace(/^\n|\n$/g, ''))
	}
	return cache.get(html)
}
