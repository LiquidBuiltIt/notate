import React from 'react'

// What the host of an editor lets note links and tags do. null (no provider) means both stay inert.
//   titles: titles of the notes a [[link]] may open (for the resolved look)
//   openNote(title), openTag(tag): called from a real click only; openTag may be missing
export const EditorLinksContext = React.createContext(null)

// Case-insensitive match; an exact-case title wins.
export const findByTitle = (notes, title) => {
	const want = String(title ?? '').trim().toLowerCase()
	if (!want) return null
	const all = (notes ?? []).filter((n) => typeof n?.title === 'string')
	return all.find((n) => n.title.trim() === String(title).trim()) ?? all.find((n) => n.title.trim().toLowerCase() === want) ?? null
}

const SAFE_TITLE = (t) => typeof t === 'string' && t.length > 0 && t.length <= 200 && !/[\[\]|\u0000-\u001f\u007f]/.test(t) && t === t.trim()

// CSS for the links that point at a real note, and for tags that can be clicked. Titles go through string escaping, never into markup.
export const linkStyles = (links) => {
	if (!links) return ''
	const esc = (t) => t.replace(/[\\"]/g, '\\$&')
	const titles = [...new Set((links.titles ?? []).filter(SAFE_TITLE).map((t) => t.toLowerCase()))].slice(0, 500)
	const rules = []
	if (titles.length) rules.push(`${titles.map((t) => `#input-text-display [data-note-link="${esc(t)}" i]`).join(',')}{color:#1B1A17 !important;border-bottom:1px solid #B8321A;cursor:pointer}${titles.map((t) => `#input-text-display [data-note-link="${esc(t)}" i]:hover::after`).join(',')}{display:none}`)
	if (links.openTag) rules.push('#input-text-display [data-tag]{cursor:pointer}')
	return rules.join('\n')
}
