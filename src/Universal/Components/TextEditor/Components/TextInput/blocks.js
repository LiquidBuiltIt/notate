import { TEXT_EDITOR_ID } from './TextInput.jsx'

// Block formats (lists, checkbox, headings, quote). All of them go through execCommand, so Ctrl+Z undoes them.
// A checkbox is a list item with data-checked; the box is drawn by CSS and is never an <input>.
const TAGS = { h1: 'h1', h2: 'h2', quote: 'blockquote' }
const SHORTCUTS = { '-': 'ul', '*': 'ul', '1.': 'ol', '[ ]': 'check', '#': 'h1', '##': 'h2', '>': 'quote' }
const BLOCK_TAGS = new Set(['br', 'div', 'p', 'ul', 'ol', 'h1', 'h2', 'blockquote'])

// The element of the caret, if it is inside the editor.
const caretIn = (root, selector) => {
	const node = root.getSelection()?.anchorNode
	const found = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest(selector)
	return found && root.getElementById(TEXT_EDITOR_ID)?.contains(found) ? found : null
}

export const applyBlock = (root, kind) => {
	if (kind === 'ul' || kind === 'ol') return document.execCommand(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList')
	if (kind === 'check') {
		const li = caretIn(root, 'li')
		if (li && !li.hasAttribute('data-checked')) return li.setAttribute('data-checked', 'false')
		// Second press: the item stops being a checkbox and the list is undone.
		if (li) return document.execCommand(li.parentElement.localName === 'ol' ? 'insertOrderedList' : 'insertUnorderedList')
		document.execCommand('insertUnorderedList')
		return caretIn(root, 'li')?.setAttribute('data-checked', 'false')
	}
	document.execCommand('formatBlock', false, caretIn(root, TAGS[kind]) ? 'div' : TAGS[kind])
}

export const toggleChecked = (li) => li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true')

// Ctrl+Enter: flip the item the caret is in. Returns false when the caret is not in a checkbox.
export const toggleCaretItem = (root) => {
	const li = caretIn(root, 'li[data-checked]')
	if (li) toggleChecked(li)
	return !!li
}

export const uncheckCaretItem = (root) => caretIn(root, 'li[data-checked]')?.setAttribute('data-checked', 'false')

// Typing Space after "-", "1.", "[ ]", "#" ... at the start of a line turns the line into that block. Returns true when it did.
export const blockShortcut = (root) => {
	const selection = root.getSelection()
	const node = selection?.anchorNode
	if (!selection.isCollapsed || node?.nodeType !== Node.TEXT_NODE) return false
	const prefix = node.data.slice(0, selection.anchorOffset).replace(/ /g, ' ')
	const kind = Object.hasOwn(SHORTCUTS, prefix) && SHORTCUTS[prefix]
	const parent = node.parentElement
	const before = node.previousSibling
	if (!kind || !(parent.id === TEXT_EDITOR_ID || ['div', 'p'].includes(parent.localName)) || (before && !BLOCK_TAGS.has(before.localName))) return false
	selection.setBaseAndExtent(node, 0, node, selection.anchorOffset)
	document.execCommand('delete')
	applyBlock(root, kind)
	return true
}
