// Note content is stored as HTML. DOMParser documents are inert: nothing in it loads or runs.
// shortcut: the cache is never trimmed, upgrade if a session holds thousands of long notes.
const cache = new Map()

export default function plainText(html = '') {
	if (!cache.has(html)) {
		const doc = new DOMParser().parseFromString(html, 'text/html')
		doc.body.querySelectorAll('br, div, p, li').forEach(el => el.append(' '))
		cache.set(html, doc.body.textContent)
	}
	return cache.get(html)
}
